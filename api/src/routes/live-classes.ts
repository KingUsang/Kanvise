import { Hono } from 'hono'
import { AccessToken, RoomServiceClient, TrackSource, WebhookReceiver } from 'livekit-server-sdk'
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
import { ensureLiveKitWorkerReady, isLiveKitHealthy } from '../livekit/worker-lifecycle'
import { createPlugNmeetRoom, getPlugNmeetClientConfig, providerForClass, persistProvider } from '../plugnmeet/provider'
import { publishClassRecap } from '../jobs/live-class-recording'
import { reconcileRecorderFleet } from '../recording/recorder-fleet'

export const liveClassesRouter = new Hono<{ Variables: TenantVariables }>()

// ── Helpers ────────────────────────────────────────────────────────────────

function getLiveKitConfig() {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const wsUrl = process.env.LIVEKIT_URL

  if (!apiKey || !apiSecret || !wsUrl) {
    throw new Error('LiveKit environment variables are not configured on the Hono server.')
  }

  const httpUrl = wsUrl.replace('wss://', 'https://').replace('ws://', 'http://')
  return { apiKey, apiSecret, wsUrl, httpUrl }
}

function getRoomService() {
  const { apiKey, apiSecret, httpUrl } = getLiveKitConfig()
  return new RoomServiceClient(httpUrl, apiKey, apiSecret)
}

async function getParticipantDisplayName(user: { id: string; first_name?: string; last_name?: string; kanvise_user_id?: string }, fallback: string) {
  const fromClaims = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  if (fromClaims) return fromClaims

  // Auth claims intentionally contain only trusted authorisation data. Names
  // belong to the canonical profile, so resolve them here for LiveKit's public
  // participant label instead of showing an internal Kanvise ID.
  const { data } = await supabase.from('user_profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle()
  const fromProfile = `${data?.first_name || ''} ${data?.last_name || ''}`.trim()
  return fromProfile || user.kanvise_user_id || fallback
}

async function generateToken(
  identity: string,
  name: string,
  roomName: string,
  isHost: boolean,
  avatarConfig: Record<string, string | null> | null,
): Promise<string> {
  const { apiKey, apiSecret } = getLiveKitConfig()
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    metadata: JSON.stringify(buildParticipantMetadata(isHost, avatarConfig)),
  })
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    // Screen sharing is disabled for the whole classroom. Limit every token
    // to camera and microphone so the UI restriction cannot be bypassed.
    canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
    roomAdmin: isHost,
  })
  return at.toJwt()
}

export function buildParticipantMetadata(
  isHost: boolean,
  avatarConfig: Record<string, string | null> | null,
) {
  return { isHost, avatar_config: avatarConfig }
}

async function getAvatarConfig(userId: string, schoolId: string | null) {
  if (!schoolId) return null
  const { data, error } = await supabase.from('avatar_configs')
    .select('skin_tone, face_shape, hair_style, hair_colour, outfit_colour, accessory, headwear')
    .eq('user_id', userId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (error) {
    console.error('[live-classes] Failed to load avatar config:', error)
    return null
  }
  return data
}

async function studentCanAccessCourse(studentId: string, schoolId: string, courseId: string) {
  return (await loadStudentCourseIds(studentId, schoolId)).includes(courseId)
}

async function requireClassroom(c: any, level: 'view' | 'host' = 'view', hideStudentCourse = false) {
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

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const close = () => {
        closed = true
        try { controller.close() } catch { /* already closed */ }
      }

      try {
        // Trigger VM start if needed — idempotent, safe to call when already running
        const worker = await ensureLiveKitWorkerReady()

        if (worker.state === 'unavailable') {
          controller.enqueue(encode({ phase: 'unavailable', message: worker.message ?? 'The classroom server could not be started.' }))
          return close()
        }

        if (worker.state === 'ready') {
          controller.enqueue(encode({ phase: 'ready' }))
          return close()
        }

        // VM is booting — stream progress phases to the browser
        controller.enqueue(encode({ phase: 'starting_vm' }))

        const MAX_WAIT_MS = 120_000   // 2 minute absolute ceiling
        const POLL_INTERVAL_MS = 3_000
        const started = Date.now()

        const poll = async () => {
          if (closed) return
          const elapsed = Date.now() - started

          if (elapsed >= MAX_WAIT_MS) {
            controller.enqueue(encode({ phase: 'unavailable', message: 'The classroom server took too long to start. Please try again.' }))
            return close()
          }

          const healthy = await isLiveKitHealthy()
          if (healthy) {
            controller.enqueue(encode({ phase: 'ready' }))
            return close()
          }

          // Advance the visual phase on the client stepper
          const phase = elapsed < 30_000 ? 'booting' : 'connecting'
          controller.enqueue(encode({ phase, elapsed_ms: elapsed }))
          setTimeout(poll, POLL_INTERVAL_MS)
        }

        setTimeout(poll, POLL_INTERVAL_MS)
      } catch (error) {
        console.error('[live-classes] readiness/stream failed:', error)
        if (!closed) {
          controller.enqueue(encode({ phase: 'unavailable', message: 'The classroom is temporarily unavailable.' }))
          close()
        }
      }
    },
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
// wake/check the LiveKit worker, but it does not create a room or issue a
// participant token. The browser can safely call it after refresh/reconnect.
liveClassesRouter.get('/:id/readiness', async (c) => {
  const access = await requireClassroom(c, c.req.query('intent') === 'start' ? 'host' : 'view')
  if ('response' in access) return access.response
  const liveClass = access.liveClass as any
  try {
    const worker = await ensureLiveKitWorkerReady()
    if (worker.state === 'preparing') return c.json({ data: { state: 'starting', retry_after_seconds: worker.retryAfterSeconds } })
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
    const timezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : 'Africa/Lagos'
    const { data: seriesId, error: recurringError } = await supabase.rpc('create_recurring_live_class' as any, {
      p_school_id: user.school_id,
      p_actor_id: user.id,
      p_course_id: course_id,
      p_tutor_id: tutor_id,
      p_title: title,
      p_starts_on: body.starts_on,
      p_start_time: body.start_time,
      p_timezone: timezone,
      p_duration_minutes: duration_minutes,
    } as any)
    if (recurringError) {
      console.error('[live-classes] recurring insert error:', recurringError)
      return c.json({ error: recurringError.message || 'Failed to schedule recurring class', code: 'RECURRING_CLASS_FAILED' }, 400)
    }
    return c.json({ data: { series_id: seriesId, recurrence: 'weekly' } }, 201)
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

  const roomName = `kanvise-class-${insertedClass.id}`
  if (classroomProvider === 'plugnmeet') {
    try {
      // Start-now is supported. It has no T-10 timetable window, so request
      // recorder capacity before making the room live. The recorder controller
      // is intentionally best-effort while the fleet rollout is disabled.
      await reconcileRecorderFleet()
      const room = await createPlugNmeetRoom({
        roomId: insertedClass.id,
        title: insertedClass.title,
        schoolId: user.school_id,
        courseId: insertedClass.course_id,
        accessMode,
      })
      await persistProvider({ classId: insertedClass.id, provider: 'plugnmeet', providerRoomId: room.providerRoomId, schoolId: user.school_id })
      const { error: startUpdateError } = await (supabase as any).from('live_classes').update({ status: 'live', started_at: startedAt, provider_room_status: 'ready', provider_room_checked_at: startedAt }).eq('id', insertedClass.id).eq('school_id', user.school_id)
      if (startUpdateError) throw startUpdateError
      const isHost = insertedClass.tutor_id === user.id
      const config = await getPlugNmeetClientConfig({ roomId: insertedClass.id, userId: user.id, name: await getParticipantDisplayName(user, isHost ? 'Tutor' : 'Administrator'), isHost, schoolId: user.school_id, accessMode })
      return c.json({ data: { ...insertedClass, status: 'live', started_at: startedAt, class_title: insertedClass.title, course_name: course?.name || null, share_token: shareToken, ...config } }, 201)
    } catch (error) {
      console.error('[live-classes] plugnmeet start-now failed:', error)
      await supabase.from('live_classes').delete().eq('id', insertedClass.id).eq('school_id', user.school_id)
      return c.json({ error: 'Could not start the PlugNmeet class. Nothing was scheduled.', code: 'CLASS_START_FAILED' }, 500)
    }
  }
  let roomCreated = false
  try {
    const worker = await ensureLiveKitWorkerReady()
    if (worker.state === 'preparing') {
      return c.json({ data: {
        ...insertedClass,
        state: 'preparing',
        retry_after_seconds: worker.retryAfterSeconds,
        class_title: insertedClass.title,
        course_name: course?.name || null,
        share_token: shareToken,
        is_host: true,
      } }, 202)
    }
    if (worker.state !== 'ready') throw new Error(worker.message || 'LIVEKIT_WORKER_UNAVAILABLE')
    const roomService = getRoomService()
    await roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 200 })
    roomCreated = true

    const { data: liveClass, error: updateError } = await (supabase.from('live_classes') as any)
      .update({ status: 'live', livekit_room_name: roomName, started_at: startedAt })
      .eq('id', insertedClass.id)
      .eq('school_id', user.school_id)
      .select('id, title, course_id, tutor_id, duration_minutes, status, scheduled_at, started_at, livekit_room_name')
      .single()
    if (updateError || !liveClass) throw new Error('CLASS_UPDATE_FAILED')

    const displayName = await getParticipantDisplayName(user, 'Tutor')
    const accessToken = await generateToken(user.id, displayName, roomName, true, await getAvatarConfig(user.id, user.school_id))
    const { wsUrl } = getLiveKitConfig()

    return c.json({
      data: {
        ...liveClass,
        access_token: accessToken,
        livekit_url: wsUrl,
        is_host: true,
        class_title: liveClass.title,
        course_name: course?.name || null,
        share_token: shareToken,
      },
    }, 201)
  } catch (error) {
    console.error('[live-classes] start-now failed:', error)
    if (roomCreated) {
      try {
        await getRoomService().deleteRoom(roomName)
      } catch {
        // Continue with database compensation even if room cleanup fails.
      }
    }
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
    .select('id, title, scheduled_at, duration_minutes, status, started_at, ended_at, course_id, tutor_id, timetable_slot_id, classroom_provider, provider_room_status, provider_room_checked_at, course:courses(id, name), tutor:user_profiles!live_classes_tutor_id_fkey(id, first_name, last_name), series:class_timetable_slots!live_classes_timetable_slot_id_fkey(source), recording:live_class_recordings(status), recap:live_class_recaps(status)')
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
    return c.json({ error: 'Failed to update class' }, 500)
  }

  return c.json({ data })
})

// ── DELETE /live-classes/:id — Cancel a scheduled class (Admin) ──────────

liveClassesRouter.delete('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const reason = c.req.query('reason') || undefined
  const access = await requireClassroom(c)
  if ('response' in access) return access.response
  const liveClass = access.liveClass as any
  if (liveClass.status !== 'scheduled') {
    return c.json({ error: 'Only scheduled classes can be cancelled', code: 'CLASS_NOT_CANCELLABLE' }, 409)
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
  const access = await requireClassroom(c, user.role === 'admin' ? 'view' : 'host')
  if ('response' in access) return access.response
  const liveClass = access.liveClass as any
  const classroomProvider = providerForClass({ accessMode: liveClass.access_mode, schoolId: user.school_id, persisted: liveClass.classroom_provider })

  if (classroomProvider === 'plugnmeet') {
    if (liveClass.status === 'live') {
      try {
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
      const roomId = liveClass.id
      await reconcileRecorderFleet()
      await createPlugNmeetRoom({ roomId, title: liveClass.title, schoolId: user.school_id, courseId: liveClass.course_id, accessMode: liveClass.access_mode })
      const startedAt = new Date().toISOString()
      const { data: updated, error } = await (supabase as any).from('live_classes').update({ status: 'live', classroom_provider: 'plugnmeet', provider_room_id: roomId, started_at: startedAt, provider_room_status: 'ready', provider_room_checked_at: startedAt }).eq('id', liveClass.id).eq('school_id', user.school_id).select('id, title, course_id, tutor_id, duration_minutes, status, scheduled_at, started_at, classroom_provider, provider_room_id, provider_room_status, provider_room_checked_at').single()
      if (error || !updated) throw error || new Error('CLASS_UPDATE_FAILED')
      const config = await getPlugNmeetClientConfig({ roomId, userId: user.id, name: await getParticipantDisplayName(user, 'Tutor'), isHost: true, schoolId: user.school_id, accessMode: liveClass.access_mode })
      return c.json({ data: { ...updated, ...config, class_title: updated.title, course_name: (liveClass.courses as any)?.name || null } })
    } catch (error) {
      console.error('[live-classes] plugnmeet start failed:', error)
      return c.json({ error: 'Could not start the PlugNmeet class', code: 'CLASS_START_FAILED' }, 500)
    }
  }

  if (liveClass.status === 'live') {
    const worker = await ensureLiveKitWorkerReady()
    if (worker.state === 'preparing') {
      return c.json({ data: {
        id,
        state: 'preparing',
        retry_after_seconds: worker.retryAfterSeconds,
        class_title: liveClass.title,
        course_name: (liveClass.courses as any)?.name || null,
        is_host: true,
      } }, 202)
    }
    if (worker.state !== 'ready') {
      return c.json({ error: 'Could not prepare this classroom right now', code: 'LIVEKIT_WORKER_UNAVAILABLE' }, 503)
    }
    // If the tutor refreshes the page, the class is already live. Just let them back in!
    const roomName = liveClass.livekit_room_name || `kanvise-class-${id}`
    const displayName = await getParticipantDisplayName(user, 'Tutor')
    const token = await generateToken(user.id, displayName, roomName, true, await getAvatarConfig(user.id, user.school_id))
    const { wsUrl } = getLiveKitConfig()
    return c.json({ data: {
      livekit_room_name: roomName,
      access_token: token,
      livekit_url: wsUrl,
      is_host: true,
      class_title: liveClass.title,
      course_name: (liveClass.courses as any)?.name || null,
    } })
  }

  if (liveClass.status !== 'scheduled') {
    return c.json({ error: 'Only scheduled classes can be started', code: 'CLASS_NOT_SCHEDULED' }, 400)
  }

  if (!access.isHost) return c.json({ error: 'Only the assigned tutor can start this class', code: 'NOT_CLASS_TUTOR' }, 403)

  const roomName = `kanvise-class-${id}`

  const worker = await ensureLiveKitWorkerReady()
  if (worker.state === 'preparing') {
    return c.json({ data: {
      id,
      state: 'preparing',
      retry_after_seconds: worker.retryAfterSeconds,
      class_title: liveClass.title,
      course_name: (liveClass.courses as any)?.name || null,
      is_host: true,
    } }, 202)
  }
  if (worker.state !== 'ready') {
    return c.json({ error: worker.message || 'The classroom server is unavailable', code: 'LIVEKIT_WORKER_UNAVAILABLE' }, 503)
  }

  try {
    const roomService = getRoomService()
    await roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 200 })
  } catch (e) {
    console.error('[live-classes] createRoom error:', e)
    return c.json({ error: 'Failed to create LiveKit room' }, 500)
  }

  const { error: updateError } = await supabase
    .from('live_classes')
    .update({ status: 'live', livekit_room_name: roomName, started_at: new Date().toISOString() })
    .eq('id', id)
  if (updateError) {
    try {
      await getRoomService().deleteRoom(roomName)
    } catch {
      // The database error is the actionable failure; room cleanup is best effort.
    }
    return c.json({ error: 'Could not start the class', code: 'CLASS_START_FAILED' }, 500)
  }

  const displayName = await getParticipantDisplayName(user, 'Tutor')
  const token = await generateToken(user.id, displayName, roomName, true, await getAvatarConfig(user.id, user.school_id))
  const { wsUrl } = getLiveKitConfig()

  return c.json({ data: {
    livekit_room_name: roomName,
    access_token: token,
    livekit_url: wsUrl,
    is_host: true,
    class_title: liveClass.title,
    course_name: (liveClass.courses as any)?.name || null,
  } })
})

// ── POST /live-classes/:id/join — Participant joins a class ───────────────

liveClassesRouter.post('/:id/join', requireRole('tutor', 'student', 'admin'), async (c) => {
  const user = c.get('user')
  const access = await requireClassroom(c)
  if ('response' in access) return access.response
  const liveClass = access.liveClass as any

  if (providerForClass({ accessMode: liveClass.access_mode, schoolId: user.school_id, persisted: liveClass.classroom_provider }) === 'plugnmeet') {
    if (liveClass.status !== 'live') return c.json({ error: 'Class is not currently live', code: 'CLASS_NOT_LIVE' }, 404)
    try {
      const config = await getPlugNmeetClientConfig({ roomId: liveClass.provider_room_id || liveClass.id, userId: user.id, name: await getParticipantDisplayName(user, 'Participant'), isHost: access.isHost, schoolId: user.school_id, accessMode: liveClass.access_mode })
      return c.json({ data: { ...config, class_title: liveClass.title, course_name: (liveClass.courses as any)?.name || null } })
    } catch (error) {
      console.error('[live-classes] plugnmeet join failed:', error)
      return c.json({ error: 'Could not prepare this classroom right now', code: 'PLUGNMEET_UNAVAILABLE' }, 503)
    }
  }

  if (liveClass.status !== 'live' || !liveClass.livekit_room_name) {
    return c.json({ error: 'Class is not currently live', code: 'CLASS_NOT_LIVE' }, 404)
  }

  // A room can still be marked live after the classroom service has been
  // paused. Prepare it before handing the browser a token it cannot use.
  const worker = await ensureLiveKitWorkerReady()
  if (worker.state === 'preparing') {
    return c.json({ data: {
      id: liveClass.id,
      state: 'preparing',
      retry_after_seconds: worker.retryAfterSeconds,
      class_title: liveClass.title,
      course_name: (liveClass.courses as any)?.name || null,
      is_host: access.isHost,
    } }, 202)
  }
  if (worker.state !== 'ready') {
    return c.json({ error: 'Could not prepare this classroom right now', code: 'LIVEKIT_WORKER_UNAVAILABLE' }, 503)
  }

  // Only the assigned tutor gets host permissions. School admins may join as
  // non-host observers; unassigned tutors cannot enter another tutor's class.
  const isHost = access.isHost
  const displayName = await getParticipantDisplayName(user, 'Participant')
  const token = await generateToken(
    user.id,
    displayName,
    liveClass.livekit_room_name,
    isHost,
    await getAvatarConfig(user.id, user.school_id),
  )
  const { wsUrl } = getLiveKitConfig()

  return c.json({
    data: {
      livekit_room_name: liveClass.livekit_room_name,
      access_token: token,
      livekit_url: wsUrl,
      is_host: isHost,
      class_title: liveClass.title,
      course_name: (liveClass.courses as any)?.name || null,
    },
  })
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

  if (providerForClass({ accessMode: liveClass.access_mode, schoolId: user.school_id, persisted: liveClass.classroom_provider }) === 'plugnmeet') {
    if (liveClass.status !== 'live') return c.json({ error: 'Class is not currently live', code: 'CLASS_NOT_LIVE' }, 400)
    const endedAt = new Date().toISOString()
    const { error } = await supabase.from('live_classes').update({ status: 'completed', ended_at: endedAt, provider_room_status: 'ended', provider_room_checked_at: endedAt }).eq('id', liveClass.id).eq('school_id', user.school_id).eq('status', 'live')
    if (error) return c.json({ error: 'Could not complete the class record', code: 'CLASS_END_UPDATE_FAILED' }, 500)
    try {
      const { plugNmeet } = await import('../plugnmeet/client')
      await plugNmeet.endRoom(liveClass.provider_room_id || liveClass.id)
    } catch (error) {
      console.warn('[live-classes] plugnmeet room end warning:', error)
    }
    return c.json({ message: 'Live class ended' })
  }

  if (liveClass.status !== 'live' || !liveClass.livekit_room_name) {
    return c.json({ error: 'Class is not currently live', code: 'CLASS_NOT_LIVE' }, 400)
  }
  const { error: updateError } = await supabase
    .from('live_classes')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', liveClass.id)
    .eq('school_id', user.school_id)
    .eq('status', 'live')
  if (updateError) {
    return c.json({ error: 'Could not complete the class record', code: 'CLASS_END_UPDATE_FAILED' }, 500)
  }

  // Ending the class must feel immediate to the tutor. Mark it completed
  // first, then ask LiveKit to close every participant connection without
  // holding the browser hostage to a remote room-service round trip.
  void (async () => {
    try {
      await getRoomService().deleteRoom(liveClass.livekit_room_name)
    } catch (error) {
      // New joins are already denied by the completed class status. Existing
      // participants will leave naturally if this best-effort disconnect fails.
      console.warn('[live-classes] background deleteRoom warning:', error)
    }
  })()

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

// ── POST /live-classes/:id/host-action — Kick / Mute / Lower hand ─────────

// TODO(auth): Remove 'admin' role bypass after MVP testing is complete
liveClassesRouter.post('/:id/host-action', requireRole('tutor', 'admin'), async (c) => {
  const { action, identity, trackSid } = await c.req.json()
  const access = await requireClassroom(c, 'host')
  if ('response' in access) return access.response
  const liveClass = access.liveClass as any

  if (liveClass.status !== 'live' || !liveClass.livekit_room_name) {
    return c.json({ error: 'Class is not currently live' }, 400)
  }

  const roomService = getRoomService()
  const roomName = liveClass.livekit_room_name

  try {
    if (action === 'kick') {
      await roomService.removeParticipant(roomName, identity)
      return c.json({ success: true, action: 'kick', identity })
    }

    if (action === 'mute') {
      if (!trackSid) return c.json({ error: 'trackSid is required for mute' }, 400)
      await roomService.mutePublishedTrack(roomName, identity, trackSid, true)
      return c.json({ success: true, action: 'mute', identity })
    }

    if (action === 'lowerHand') {
      await roomService.updateParticipant(roomName, identity, {
        attributes: { handRaised: '' },
      })
      return c.json({ success: true, action: 'lowerHand', identity })
    }

    return c.json({ error: 'Invalid action', code: 'INVALID_ACTION' }, 400)
  } catch (e: any) {
    console.error('[live-classes] host-action error:', e)
    return c.json({ error: e.message || 'LiveKit action failed' }, 500)
  }
})
