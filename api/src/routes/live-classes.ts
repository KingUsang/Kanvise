import { Hono } from 'hono'
import { createHash, randomBytes } from 'node:crypto'
import { supabase } from '../lib/supabase'
import {
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  tenantMiddleware,
  requireRole,
} from '../middleware/auth'
import type { TenantVariables } from '../types'
import { notifyClassCancelled } from '../notifications/triggers'
import { createPresignedDownload } from '../storage/r2'
import { loadStudentCourseIds } from '../lib/student-course-access'
import { classroomAccessError, resolveClassroomAccess } from '../lib/classroom-access'
import { ensurePlugNmeetReady, isPlugNmeetHealthy } from '../plugnmeet/classroom-lifecycle'
import { createPlugNmeetRoom, getPlugNmeetClientConfig, providerForClass, persistProvider } from '../plugnmeet/provider'
import { publishClassRecap } from '../jobs/live-class-recording'
import { reconcileRecorderFleet, recorderReadyForClass } from '../recording/recorder-fleet'

export const liveClassesRouter = new Hono<{ Variables: TenantVariables }>()

// ── Helpers ────────────────────────────────────────────────────────────────

async function getParticipantDisplayName(user: { id: string; first_name?: string; last_name?: string; kanvise_user_id?: string }, fallback: string) {
  const fromClaims = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  if (fromClaims) return fromClaims

  // Auth claims intentionally contain only trusted authorisation data. Names
  // belong to the canonical profile, so resolve them for the classroom label.
  const { data } = await supabase.from('user_profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle()
  const fromProfile = `${data?.first_name || ''} ${data?.last_name || ''}`.trim()
  return fromProfile || user.kanvise_user_id || fallback
}

async function requireClassroom(c: any, level: 'view' | 'host' | 'takeover' = 'view', hideStudentCourse = false) {
  try {
    const result = await resolveClassroomAccess(c.req.param('id'), c.get('user'), level)
    if ('reason' in result) {
      // Keep the existing single-class discovery behaviour for students: an
      // unenrolled student cannot learn that a class exists by guessing its
      // ID. Presentation/join routes intentionally return NOT_ENROLLED so the
      // browser can explain an action the user has already attempted.
      const failure = classroomAccessError(hideStudentCourse && result.reason === 'not_enrolled' ? 'missing' : result.reason)
      return { response: c.json({ error: failure.error, code: failure.code }, failure.status) }
    }
    return result
  } catch (error) {
    console.error('[live-classes] class access check failed:', error)
    return { response: c.json({ error: 'Could not verify class access', code: 'CLASS_ACCESS_FAILED' }, 500) }
  }
}

// ── Apply auth middleware to all routes ────────────────────────────────────

liveClassesRouter.use(
  '/*',
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  tenantMiddleware,
)

// ── GET /live-classes/:id/readiness/stream — SSE readiness feed ───────────
// The browser opens one long-lived fetch connection. Hono streams Server-Sent
// Events down as the classroom transitions through boot phases. This replaces
// the fragile 4-second client polling loop. Using raw fetch (not EventSource)
// on the client keeps the Authorization header available.
liveClassesRouter.get('/:id/readiness/stream', async (c) => {
  const isStarting = c.req.query('intent') === 'start'
  const access = await requireClassroom(c, isStarting ? 'host' : 'view')
  if ('response' in access) return access.response

  const encode = (payload: Record<string, unknown>) =>
    new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)

  let closed = false
  const stream = new ReadableStream({
    async start(controller) {
      const close = () => {
        closed = true
        try { controller.close() } catch { /* already closed */ }
      }
      const emit = (payload: Record<string, unknown>) => {
        if (closed) return false
        try {
          controller.enqueue(encode(payload))
          return true
        } catch {
          // A client can navigate away while an infrastructure poll is in
          // flight. Treat that as cancellation, never as an API crash.
          closed = true
          return false
        }
      }

      try {
        const [worker] = await Promise.all([ensurePlugNmeetReady(), reconcileRecorderFleet()])
        if (worker.state === 'unavailable') {
          emit({ phase: 'unavailable', message: worker.message })
          return close()
        }
        if (worker.state === 'preparing') emit({ phase: 'classroom_waking' })

        // There is no guessed duration or artificial timeout. Each event is a
        // real infrastructure condition, and the stream stays open until the
        // user leaves or the classroom can be opened.
        const poll = async () => {
          try {
            if (closed) return
            if (!await isPlugNmeetHealthy()) {
              if (emit({ phase: 'classroom_waking' })) setTimeout(poll, 3_000)
              return
            }
            if (!emit({ phase: 'classroom_healthy' })) return
            const liveClass = access.liveClass as any
            const requiresRecording = liveClass.access_mode !== 'anyone_with_link' && Boolean(liveClass.course_id)
            // A scheduled room does not have a per-class recording segment
            // yet. Let the host create the room first; the start endpoint will
            // then report the short recorder handshake as `preparing`.
            if (isStarting || !requiresRecording || await recorderReadyForClass(liveClass.id)) {
              emit({ phase: 'room_ready' })
              return close()
            }
            if (emit({ phase: 'recorder_waking' })) setTimeout(poll, 3_000)
          } catch (error) {
            console.error('[live-classes] readiness poll failed:', error)
            if (emit({ phase: 'unavailable', message: 'The classroom is temporarily unavailable.' })) close()
          }
        }
        void poll()
      } catch (error) {
        console.error('[live-classes] readiness/stream failed:', error)
        if (emit({ phase: 'unavailable', message: 'The classroom is temporarily unavailable.' })) close()
      }
    },
    cancel() { closed = true },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Prevents Nginx/Caddy from buffering SSE
    },
  })
})

// ── GET /live-classes/:id/readiness — Check classroom readiness ───────────
// This is intentionally side-effect free from the class perspective: it may
// wake/check the PlugNmeet classroom, but it does not create a room or issue a
// participant token. The browser can safely call it after refresh/reconnect.
liveClassesRouter.get('/:id/readiness', async (c) => {
  const access = await requireClassroom(c, c.req.query('intent') === 'start' ? 'host' : 'view')
  if ('response' in access) return access.response
  const liveClass = access.liveClass as any
  try {
    const [worker] = await Promise.all([ensurePlugNmeetReady(), reconcileRecorderFleet()])
    if (worker.state === 'preparing') return c.json({ data: { state: 'starting' } })
    if (worker.state !== 'ready') return c.json({ data: { state: 'unavailable', message: worker.message || 'The classroom is temporarily unavailable' } }, 503)
    return c.json({ data: { state: 'ready', class_status: liveClass.status } })
  } catch (error) {
    console.error('[live-classes] readiness check failed:', error)
    return c.json({ data: { state: 'unavailable', message: 'The classroom is temporarily unavailable' } }, 503)
  }
})

// ── POST /live-classes — Schedule a class (Admin, Tutor) ───────────────────

liveClassesRouter.post('/', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { course_id, tutor_id, title, scheduled_at, duration_minutes } = body
  const accessMode = body.access_mode === 'anyone_with_link' ? 'anyone_with_link' : 'enrolled_learners'
  const isRecurring = body.recurrence === 'weekly'
  const recurrenceDays = Array.isArray(body.recurrence_days)
    ? [...new Set((body.recurrence_days as unknown[]).map((value): number => Number(value)))].filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    : []

  if ((!course_id && accessMode === 'enrolled_learners') || !tutor_id || !title || !scheduled_at || !duration_minutes || (isRecurring && (!body.starts_on || !body.start_time))) {
    return c.json({ error: 'Missing required fields', code: 'MISSING_FIELDS' }, 400)
  }

  const scheduledDate = new Date(scheduled_at)
  if (!Number.isFinite(scheduledDate.getTime()) || scheduledDate < new Date()) {
    return c.json({ error: 'Cannot schedule a class in the past', code: 'SCHEDULED_IN_PAST' }, 400)
  }

  if (typeof duration_minutes !== 'number' || duration_minutes < 15 || duration_minutes > 240) {
    return c.json({ error: 'Duration must be between 15 and 240 minutes', code: 'INVALID_DURATION' }, 400)
  }

  if (user.role === 'tutor' && tutor_id !== user.id) {
    return c.json({ error: 'Tutors can only schedule classes for themselves', code: 'FORBIDDEN' }, 403)
  }

  if (accessMode === 'anyone_with_link' && isRecurring) {
    return c.json({ error: 'Schedule each shared class separately so every session has its own private link', code: 'SHARED_RECURRING_UNSUPPORTED' }, 400)
  }

  // Structured classes keep the assignment requirement. A shared class is
  // deliberately independent of a teaching group.
  const { data: assignment, error: assignmentError } = accessMode === 'enrolled_learners' ? await supabase
    .from('tutor_course_assignments')
    .select('course_id')
    .eq('tutor_id', tutor_id)
    .eq('course_id', course_id)
    .eq('school_id', user.school_id)
    .maybeSingle() : { data: true, error: null }

  if (accessMode === 'enrolled_learners' && (assignmentError || !assignment)) {
    return c.json({ error: 'Tutor is not assigned to this course or course does not exist', code: 'INVALID_TUTOR_OR_COURSE' }, 403)
  }

  if (isRecurring) {
    const timezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : 'UTC'
    const days = recurrenceDays.length ? recurrenceDays : [new Date(`${body.starts_on}T12:00:00`).getDay() || 7]
    const { data: seriesId, error: recurringError } = await supabase.rpc('create_recurring_live_class_series' as any, {
      p_school_id: user.school_id,
      p_actor_id: user.id,
      p_course_id: course_id,
      p_tutor_id: tutor_id,
      p_title: title,
      p_starts_on: body.starts_on,
      p_start_time: body.start_time,
      p_timezone: timezone,
      p_duration_minutes: duration_minutes,
      p_weekdays: days,
    } as any)
    if (recurringError) {
      console.error('[live-classes] recurring insert error:', recurringError)
      return c.json({ error: recurringError.message || 'Failed to schedule recurring class', code: 'RECURRING_CLASS_FAILED' }, 400)
    }
    return c.json({ data: { series_id: seriesId, recurrence: 'weekly', weekdays: days } }, 201)
  }


  const shareToken = randomBytes(9).toString('base64url').slice(0, 12)
  const classroomProvider = providerForClass({ accessMode, schoolId: user.school_id })
  const { data, error } = await (supabase.from('live_classes') as any)
    .insert({
      school_id: user.school_id,
      course_id: accessMode === 'enrolled_learners' ? course_id : null,
      tutor_id,
      title,
      scheduled_at,
      duration_minutes,
      status: 'scheduled',
      created_by: user.id,
      access_mode: accessMode,
      classroom_provider: classroomProvider,
      share_token_hash: shareToken ? createHash('sha256').update(shareToken).digest('hex') : null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23P01') return c.json({ error: 'This tutor already has a class at that time', code: 'TUTOR_TIME_CONFLICT' }, 409)
    console.error('[live-classes] insert error:', error)
    return c.json({ error: 'Failed to schedule class' }, 500)
  }

  return c.json({ data: { ...data, share_token: shareToken } }, 201)
})

// ── POST /live-classes/start-now — Create and start in one workflow ───────

liveClassesRouter.post('/start-now', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const courseId = String(body.course_id || '')
  const tutorId = String(body.tutor_id || user.id)
  const accessMode = body.access_mode === 'anyone_with_link' ? 'anyone_with_link' : 'enrolled_learners'
  const durationMinutes = body.duration_minutes === undefined ? 60 : Number(body.duration_minutes)

  if (accessMode === 'enrolled_learners' && !courseId) {
    return c.json({ error: 'Choose what you are teaching', code: 'COURSE_REQUIRED' }, 400)
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
    return c.json({ error: 'Duration must be between 15 and 240 minutes', code: 'INVALID_DURATION' }, 400)
  }
  if (user.role === 'tutor' && tutorId !== user.id) {
    return c.json({ error: 'Tutors can only start their own classes', code: 'FORBIDDEN' }, 403)
  }

  const [{ data: assignment, error: assignmentError }, { data: course, error: courseError }] = accessMode === 'enrolled_learners' ? await Promise.all([
    supabase.from('tutor_course_assignments')
      .select('course_id')
      .eq('tutor_id', tutorId)
      .eq('course_id', courseId)
      .eq('school_id', user.school_id)
      .maybeSingle(),
    supabase.from('courses')
      .select('id, name')
      .eq('id', courseId)
      .eq('school_id', user.school_id)
      .maybeSingle(),
  ]) : [{ data: null, error: null }, { data: null, error: null }]

  if (accessMode === 'enrolled_learners' && (assignmentError || courseError || !assignment || !course)) {
    return c.json({ error: 'Choose a subject assigned to this tutor', code: 'INVALID_TUTOR_OR_COURSE' }, 403)
  }

  const title = String(body.title || '').trim().slice(0, 160) || (course ? `${course.name} class` : 'Live class')
  const shareToken = randomBytes(9).toString('base64url').slice(0, 12)
  const startedAt = new Date().toISOString()
  const classroomProvider = providerForClass({ accessMode, schoolId: user.school_id })
  const { data: insertedClass, error: insertError } = await (supabase.from('live_classes') as any)
    .insert({
      school_id: user.school_id,
      course_id: accessMode === 'enrolled_learners' ? courseId : null,
      tutor_id: tutorId,
      title,
      scheduled_at: startedAt,
      duration_minutes: durationMinutes,
      status: 'scheduled',
      created_by: user.id,
      access_mode: accessMode,
      share_token_hash: shareToken ? createHash('sha256').update(shareToken).digest('hex') : null,
      classroom_provider: classroomProvider,
    })
    .select('id, title, course_id, tutor_id, duration_minutes, access_mode')
    .single()

  if (insertError || !insertedClass) {
    return c.json({ error: 'Could not prepare the class', code: 'CLASS_CREATE_FAILED' }, 500)
  }

  try {
    const [worker] = await Promise.all([ensurePlugNmeetReady(), reconcileRecorderFleet()])
    if (worker.state === 'preparing') {
      return c.json({ data: { ...insertedClass, state: 'preparing', class_title: insertedClass.title, course_name: course?.name || null, share_token: shareToken, is_host: insertedClass.tutor_id === user.id } }, 202)
    }
    if (worker.state !== 'ready') throw new Error(worker.message || 'PLUGNMEET_UNAVAILABLE')
    const room = await createPlugNmeetRoom({ roomId: insertedClass.id, title: insertedClass.title, schoolId: user.school_id, courseId: insertedClass.course_id, accessMode })
    await persistProvider({ classId: insertedClass.id, provider: 'plugnmeet', providerRoomId: room.providerRoomId, schoolId: user.school_id })
    const { error: startUpdateError } = await (supabase as any).from('live_classes').update({ status: 'live', started_at: startedAt, provider_room_status: 'ready', provider_room_checked_at: startedAt }).eq('id', insertedClass.id).eq('school_id', user.school_id)
    if (startUpdateError) throw startUpdateError
    if (accessMode !== 'anyone_with_link' && insertedClass.course_id && !await recorderReadyForClass(insertedClass.id)) {
      return c.json({ data: { ...insertedClass, state: 'preparing', status: 'live', class_title: insertedClass.title, course_name: course?.name || null, share_token: shareToken, is_host: insertedClass.tutor_id === user.id, waiting_for: 'recorder' } }, 202)
    }
    const isHost = insertedClass.tutor_id === user.id
    const config = await getPlugNmeetClientConfig({ roomId: insertedClass.id, userId: user.id, name: await getParticipantDisplayName(user, isHost ? 'Tutor' : 'Administrator'), isHost, schoolId: user.school_id, accessMode })
    return c.json({ data: { ...insertedClass, status: 'live', started_at: startedAt, class_title: insertedClass.title, course_name: course?.name || null, share_token: shareToken, ...config } }, 201)
  } catch (error) {
    console.error('[live-classes] plugnmeet start-now failed:', error)
    await supabase.from('live_classes')
      .delete()
      .eq('id', insertedClass.id)
      .eq('school_id', user.school_id)
    return c.json({ error: 'Could not start the class. Nothing was scheduled.', code: 'CLASS_START_FAILED' }, 500)
  }
})

// ── GET /live-classes — List classes (role-filtered) ───────────────────────

liveClassesRouter.get('/', async (c) => {
  const user = c.get('user')
  const { course_id, status } = c.req.query()

  let query = supabase
    .from('live_classes')
    .select('id, title, scheduled_at, duration_minutes, status, started_at, ended_at, course_id, tutor_id, timetable_slot_id, access_mode, classroom_provider, provider_room_status, provider_room_checked_at, course:courses(id, name), tutor:user_profiles!live_classes_tutor_id_fkey(id, first_name, last_name), series:class_timetable_slots!live_classes_timetable_slot_id_fkey(id, source, recurrence_group_id), recording:live_class_recordings(status), recap:live_class_recaps(status)')
    .eq('school_id', user.school_id)
    .order('scheduled_at', { ascending: true })

  if (user.role === 'tutor') {
    query = query.eq('tutor_id', user.id)
  }

  if (user.role === 'student') {
    let courseIds: string[]
    try {
      courseIds = await loadStudentCourseIds(user.id, user.school_id!)
    } catch {
      return c.json({ error: 'Failed to resolve class access', code: 'CLASS_ACCESS_FAILED' }, 500)
    }
    if (!courseIds.length) return c.json({ data: [] })
    if (course_id && !courseIds.includes(course_id)) {
      return c.json({ error: 'Not enrolled in this course', code: 'NOT_ENROLLED' }, 403)
    }
    query = query.in('course_id', courseIds)
  }

  if (course_id) query = query.eq('course_id', course_id)
  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    console.error('[live-classes] list error:', error)
    return c.json({ error: 'Failed to fetch classes' }, 500)
  }

  const enriched = (data || []).map((item: any) => ({
    ...item,
    // A stale database row must not become a false "Live now" badge. A
    // PlugNmeet room becomes verified when it is created or joins report in.
    status: item.classroom_provider === 'plugnmeet' && item.status === 'live'
      && !['ready', 'active'].includes(item.provider_room_status) ? 'scheduled' : item.status,
    recording_status: Array.isArray(item.recording) ? item.recording[0]?.status || null : item.recording?.status || null,
    recap_status: Array.isArray(item.recap) ? item.recap[0]?.status || null : item.recap?.status || null,
    recording: undefined,
    recap: undefined,
  }))
  return c.json({ data: enriched })
})

// ── DELETE /live-classes/series/:seriesId — End a direct weekly series ───

liveClassesRouter.delete('/series/:seriesId', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const { data, error } = await supabase.rpc('cancel_recurring_live_class' as any, {
    p_slot_id: c.req.param('seriesId'),
    p_school_id: user.school_id,
    p_actor_id: user.id,
  } as any)
  if (error) return c.json({ error: error.message || 'Could not end recurring class', code: 'RECURRING_CLASS_CANCEL_FAILED' }, 400)
  return c.json({ message: 'Recurring class ended', removed_classes: data })
})

// ── GET /live-classes/:id — Get single class ───────────────────────────────

liveClassesRouter.get('/:id', async (c) => {
  const access = await requireClassroom(c, 'view', true)
  if ('response' in access) return access.response
  return c.json({ data: access.liveClass })
})

// ── PATCH /live-classes/:id — Update a scheduled class (Admin, Tutor) ──────

liveClassesRouter.patch('/:id', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const access = await requireClassroom(c)
  if ('response' in access) return access.response
  const { liveClass: existing } = access
  const { id } = c.req.param()
  const body = await c.req.json()

  if (existing.status !== 'scheduled') {
    return c.json({ error: 'Only scheduled classes can be updated', code: 'CLASS_NOT_EDITABLE' }, 409)
  }

  if (user.role === 'tutor' && existing.tutor_id !== user.id) {
    return c.json({ error: 'You can only update classes assigned to you', code: 'NOT_CLASS_TUTOR' }, 403)
  }

  const { title, scheduled_at, duration_minutes } = body
  const isRescheduled = scheduled_at !== undefined && scheduled_at !== existing.scheduled_at
  const { data, error } = await supabase
    .from('live_classes')
    .update({
      title,
      scheduled_at,
      duration_minutes,
      ...(isRescheduled ? { notification_sent: false } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('school_id', user.school_id)
    .select()
    .single()

  if (error) {
    if (error.code === '23P01') return c.json({ error: 'This tutor already has a class at that time', code: 'TUTOR_TIME_CONFLICT' }, 409)
    return c.json({ error: 'Failed to update class' }, 500)
  }

  return c.json({ data })
})

// ── DELETE /live-classes/:id — Cancel a scheduled class (Admin) ──────────

liveClassesRouter.delete('/:id', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const reason = c.req.query('reason') || undefined
  const access = await requireClassroom(c)
  if ('response' in access) return access.response
  const liveClass = access.liveClass as any
  if (liveClass.status !== 'scheduled') {
    return c.json({ error: 'Only scheduled classes can be cancelled', code: 'CLASS_NOT_CANCELLABLE' }, 409)
  }
  if (user.role === 'tutor' && liveClass.tutor_id !== user.id) {
    return c.json({ error: 'You can only cancel classes assigned to you', code: 'NOT_CLASS_TUTOR' }, 403)
  }

  const { data, error } = await supabase.from('live_classes')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id)
    .eq('status', 'scheduled')
    .select()
    .single()

  if (error || !data) return c.json({ error: 'Failed to cancel class' }, 500)

  const notification = await notifyClassCancelled({
    id: data.id,
    schoolId: data.school_id,
    schoolName: (liveClass.school as any)?.name || 'Your school',
    courseId: data.course_id,
    title: data.title,
    scheduledAt: data.scheduled_at,
    reason,
  })

  return c.json({ message: 'Class cancelled', data, notification })
})

// ── POST /live-classes/:id/start — Tutor starts a class ───────────────────

// TODO(auth): Remove 'admin' role bypass after MVP testing is complete
liveClassesRouter.post('/:id/start', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  // An administrator may use the same ?start=true navigation after creating
  // a class for another tutor. Once it is live they enter as an observer, not
  // as a moderator. Starting a still-scheduled class remains tutor-only.
  const access = await requireClassroom(c, user.role === 'admin' ? 'takeover' : 'host')
  if ('response' in access) return access.response
  const liveClass = access.liveClass as any
  const classroomProvider = providerForClass({ accessMode: liveClass.access_mode, schoolId: user.school_id, persisted: liveClass.classroom_provider })

  if (classroomProvider === 'plugnmeet') {
    if (liveClass.status === 'live') {
      const [worker] = await Promise.all([ensurePlugNmeetReady(), reconcileRecorderFleet()])
      if (worker.state === 'preparing') return c.json({ data: { id, state: 'preparing', class_title: liveClass.title, course_name: (liveClass.courses as any)?.name || null, is_host: access.isHost } }, 202)
      if (worker.state !== 'ready') return c.json({ error: worker.message || 'Could not prepare this classroom right now', code: 'PLUGNMEET_UNAVAILABLE' }, 503)
      try {
        if (liveClass.access_mode !== 'anyone_with_link' && liveClass.course_id && !await recorderReadyForClass(liveClass.id)) {
          return c.json({ data: { id, state: 'preparing', class_title: liveClass.title, course_name: (liveClass.courses as any)?.name || null, is_host: access.isHost, waiting_for: 'recorder' } }, 202)
        }
        const config = await getPlugNmeetClientConfig({ roomId: liveClass.provider_room_id || liveClass.id, userId: user.id, name: await getParticipantDisplayName(user, access.isHost ? 'Tutor' : 'Administrator'), isHost: access.isHost, schoolId: user.school_id, accessMode: liveClass.access_mode })
        return c.json({ data: { ...config, class_title: liveClass.title, course_name: (liveClass.courses as any)?.name || null } })
      } catch (error) {
        console.error('[live-classes] plugnmeet resume failed:', error)
        return c.json({ error: 'Could not prepare this classroom right now', code: 'PLUGNMEET_UNAVAILABLE' }, 503)
      }
    }
    if (liveClass.status !== 'scheduled') return c.json({ error: 'Only scheduled classes can be started', code: 'CLASS_NOT_SCHEDULED' }, 400)
    if (!access.isHost) return c.json({ error: 'Only the assigned tutor can start this class', code: 'NOT_CLASS_TUTOR' }, 403)
    try {
      const [worker] = await Promise.all([ensurePlugNmeetReady(), reconcileRecorderFleet()])
      if (worker.state === 'preparing') return c.json({ data: { id, state: 'preparing', class_title: liveClass.title, course_name: (liveClass.courses as any)?.name || null, is_host: true } }, 202)
      if (worker.state !== 'ready') return c.json({ error: worker.message || 'Could not prepare this classroom right now', code: 'PLUGNMEET_UNAVAILABLE' }, 503)
      const roomId = liveClass.id
      await createPlugNmeetRoom({ roomId, title: liveClass.title, schoolId: user.school_id, courseId: liveClass.course_id, accessMode: liveClass.access_mode })
      const startedAt = new Date().toISOString()
      const { data: updated, error } = await (supabase as any).from('live_classes').update({ status: 'live', classroom_provider: 'plugnmeet', provider_room_id: roomId, started_at: startedAt, provider_room_status: 'ready', provider_room_checked_at: startedAt }).eq('id', liveClass.id).eq('school_id', user.school_id).select('id, title, course_id, tutor_id, duration_minutes, status, scheduled_at, started_at, classroom_provider, provider_room_id, provider_room_status, provider_room_checked_at').single()
      if (error || !updated) throw error || new Error('CLASS_UPDATE_FAILED')
      if (liveClass.access_mode !== 'anyone_with_link' && liveClass.course_id && !await recorderReadyForClass(liveClass.id)) {
        return c.json({ data: { id, state: 'preparing', class_title: liveClass.title, course_name: (liveClass.courses as any)?.name || null, is_host: true, waiting_for: 'recorder' } }, 202)
      }
      const config = await getPlugNmeetClientConfig({ roomId, userId: user.id, name: await getParticipantDisplayName(user, 'Tutor'), isHost: true, schoolId: user.school_id, accessMode: liveClass.access_mode })
      return c.json({ data: { ...updated, ...config, class_title: updated.title, course_name: (liveClass.courses as any)?.name || null } })
    } catch (error) {
      console.error('[live-classes] plugnmeet start failed:', error)
      return c.json({ error: 'Could not start the PlugNmeet class', code: 'CLASS_START_FAILED' }, 500)
    }
  }

})

// ── POST /live-classes/:id/join — Participant joins a class ───────────────

liveClassesRouter.post('/:id/join', requireRole('tutor', 'student', 'admin'), async (c) => {
  const user = c.get('user')
  const access = await requireClassroom(c)
  if ('response' in access) return access.response
  const liveClass = access.liveClass as any

  if (providerForClass({ accessMode: liveClass.access_mode, schoolId: user.school_id, persisted: liveClass.classroom_provider }) === 'plugnmeet') {
    if (liveClass.status !== 'live') return c.json({ error: 'Class is not currently live', code: 'CLASS_NOT_LIVE' }, 404)
    const [worker] = await Promise.all([ensurePlugNmeetReady(), reconcileRecorderFleet()])
    if (worker.state === 'preparing') return c.json({ data: { id: liveClass.id, state: 'preparing', class_title: liveClass.title, course_name: (liveClass.courses as any)?.name || null, is_host: access.isHost } }, 202)
    if (worker.state !== 'ready') return c.json({ error: worker.message || 'Could not prepare this classroom right now', code: 'PLUGNMEET_UNAVAILABLE' }, 503)
    try {
      if (liveClass.access_mode !== 'anyone_with_link' && liveClass.course_id && !await recorderReadyForClass(liveClass.id)) {
        return c.json({ data: { id: liveClass.id, state: 'preparing', class_title: liveClass.title, course_name: (liveClass.courses as any)?.name || null, is_host: access.isHost, waiting_for: 'recorder' } }, 202)
      }
      const config = await getPlugNmeetClientConfig({ roomId: liveClass.provider_room_id || liveClass.id, userId: user.id, name: await getParticipantDisplayName(user, 'Participant'), isHost: access.isHost, schoolId: user.school_id, accessMode: liveClass.access_mode })
      return c.json({ data: { ...config, class_title: liveClass.title, course_name: (liveClass.courses as any)?.name || null } })
    } catch (error) {
      console.error('[live-classes] plugnmeet join failed:', error)
      return c.json({ error: 'Could not prepare this classroom right now', code: 'PLUGNMEET_UNAVAILABLE' }, 503)
    }
  }

})

liveClassesRouter.get('/:id/recording', async (c) => {
  const access = await requireClassroom(c, 'view', true)
  if ('response' in access) return access.response
  if (access.liveClass.classroom_provider !== 'plugnmeet' || !access.liveClass.course_id || access.liveClass.access_mode === 'anyone_with_link') {
    return c.json({ error: 'Recording is not available for this class', code: 'RECORDING_UNAVAILABLE' }, 404)
  }
  const { data, error } = await (supabase as any).from('live_class_recordings').select('id, status, provider_recording_id, r2_file_key, content_type, file_size_bytes, started_at, ended_at').eq('live_class_id', access.liveClass.id).eq('status', 'ready').maybeSingle()
  if (error) return c.json({ error: 'Could not load recording', code: 'RECORDING_UNAVAILABLE' }, 500)
  if (!data) return c.json({ error: 'Recording is not ready', code: 'RECORDING_NOT_READY' }, 404)
  let playbackUrl: string | null = null
  if (data.r2_file_key) {
    try {
      const download = c.req.query('download') === '1'
      const safeTitle = String(access.liveClass.title || 'kanvise-class-recording')
        .replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'kanvise-class-recording'
      playbackUrl = await createPresignedDownload(data.r2_file_key, String(access.liveClass.school_id), 600,
        download ? { responseContentDisposition: `attachment; filename="${safeTitle}.mp4"` } : undefined)
    } catch (downloadError) { console.warn('[recording] signed playback URL unavailable:', downloadError) }
  }
  return c.json({ data: { ...data, playback_url: playbackUrl, access: 'enrolled_students_tutor_admin', disposition: c.req.query('download') === '1' ? 'attachment' : 'inline' } })
})

liveClassesRouter.get('/:id/recap', async (c) => {
  const access = await requireClassroom(c, 'view', true)
  if ('response' in access) return access.response
  if (access.liveClass.classroom_provider !== 'plugnmeet' || !access.liveClass.course_id || access.liveClass.access_mode === 'anyone_with_link') {
    return c.json({ error: 'Class summary is not available for this class', code: 'RECAP_UNAVAILABLE' }, 404)
  }
  const { data, error } = await (supabase as any).from('live_class_recaps')
    .select(access.isHost ? 'id, live_class_id, draft_body, published_body, status, published_at, updated_at' : 'id, live_class_id, published_body, status, published_at, updated_at')
    .eq('live_class_id', access.liveClass.id)
    .or(access.isHost ? 'status.eq.draft,status.eq.published' : 'status.eq.published')
    .maybeSingle()
  if (error) return c.json({ error: 'Could not load class summary', code: 'RECAP_UNAVAILABLE' }, 500)
  if (!data) return c.json({ error: 'Class summary is not ready', code: 'RECAP_NOT_READY' }, 404)
  return c.json({ data })
})

liveClassesRouter.patch('/:id/recap', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const access = await requireClassroom(c, 'host')
  if ('response' in access) return access.response
  const body = await c.req.json().catch(() => ({}))
  const draft = typeof body.body === 'string' ? body.body.trim().slice(0, 20_000) : ''
  if (!draft) return c.json({ error: 'Summary body is required', code: 'MISSING_FIELDS' }, 400)
  const { data, error } = await (supabase as any).from('live_class_recaps').upsert({ live_class_id: access.liveClass.id, school_id: user.school_id, course_id: access.liveClass.course_id, tutor_id: access.liveClass.tutor_id, draft_body: draft, status: 'draft', updated_at: new Date().toISOString() }, { onConflict: 'live_class_id' }).select('id, live_class_id, draft_body, status, updated_at').single()
  if (error) return c.json({ error: 'Could not save summary draft', code: 'RECAP_SAVE_FAILED' }, 500)
  return c.json({ data })
})

liveClassesRouter.post('/:id/recap/publish', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const access = await requireClassroom(c, 'host')
  if ('response' in access) return access.response
  const body = await c.req.json().catch(() => ({}))
  const recapBody = typeof body.body === 'string' ? body.body : ''
  try {
    const data = await publishClassRecap({ classId: access.liveClass.id, tutorId: access.liveClass.tutor_id, body: recapBody })
    return c.json({ data })
  } catch (error) {
    console.error('[recap] publish failed:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Could not publish class summary', code: 'RECAP_PUBLISH_FAILED' }, 500)
  }
})

// ── POST /live-classes/:id/end — Tutor ends a class ──────────────────────

liveClassesRouter.post('/:id/end', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const access = await requireClassroom(c, 'host')
  if ('response' in access) return access.response
  const liveClass = access.liveClass as any

  if (liveClass.status !== 'live') return c.json({ error: 'Class is not currently live', code: 'CLASS_NOT_LIVE' }, 400)
  const endedAt = new Date().toISOString()
  const { error } = await (supabase as any).from('live_classes').update({ status: 'completed', ended_at: endedAt, provider_room_status: 'ended', provider_room_checked_at: endedAt }).eq('id', liveClass.id).eq('school_id', user.school_id).eq('status', 'live')
  if (error) return c.json({ error: 'Could not complete the class record', code: 'CLASS_END_UPDATE_FAILED' }, 500)
  try {
    const { plugNmeet } = await import('../plugnmeet/client')
    await plugNmeet.endRoom(liveClass.provider_room_id || liveClass.id)
  } catch (error) {
    console.warn('[live-classes] plugnmeet room end warning:', error)
  }
  return c.json({ message: 'Live class ended' })
})

// ── POST /live-classes/:id/regenerate-link — invalidate a leaked class link ─

liveClassesRouter.post('/:id/regenerate-link', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const access = await requireClassroom(c, 'host')
  if ('response' in access) return access.response
  const liveClass = access.liveClass as any
  if (liveClass.access_mode !== 'anyone_with_link') return c.json({ error: 'Only shared classes have a link to regenerate', code: 'NOT_SHARED_CLASS' }, 400)
  const shareToken = randomBytes(9).toString('base64url').slice(0, 12)
  const now = new Date().toISOString()
  const { error } = await (supabase.from('live_classes') as any).update({
    share_token_hash: createHash('sha256').update(shareToken).digest('hex'), share_link_revoked_at: null,
  }).eq('id', liveClass.id).eq('school_id', user.school_id)
  if (error) return c.json({ error: 'Could not create a new class link', code: 'LINK_REGENERATE_FAILED' }, 500)
  await (supabase as any).from('live_class_guests').update({ revoked_at: now }).eq('live_class_id', liveClass.id).is('revoked_at', null)
  return c.json({ data: { share_token: shareToken } })
})
