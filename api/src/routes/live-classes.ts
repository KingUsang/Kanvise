import { Hono } from 'hono'
import { AccessToken, RoomServiceClient, TrackSource, WebhookReceiver } from 'livekit-server-sdk'
import { supabase } from '../lib/supabase'
import {
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  tenantMiddleware,
  requireRole,
} from '../middleware/auth'
import type { AppVariables } from '../types'
import { notifyClassCancelled } from '../notifications/triggers'
import { loadStudentCourseIds } from '../lib/student-course-access'

export const liveClassesRouter = new Hono<{ Variables: AppVariables }>()

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

// ── Apply auth middleware to all routes ────────────────────────────────────

liveClassesRouter.use(
  '/*',
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  tenantMiddleware,
)

// ── POST /live-classes — Schedule a class (Admin, Tutor) ───────────────────

liveClassesRouter.post('/', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { course_id, tutor_id, title, scheduled_at, duration_minutes } = body

  if (!course_id || !tutor_id || !title || !scheduled_at || !duration_minutes) {
    return c.json({ error: 'Missing required fields', code: 'MISSING_FIELDS' }, 400)
  }

  if (new Date(scheduled_at) < new Date()) {
    return c.json({ error: 'Cannot schedule a class in the past', code: 'SCHEDULED_IN_PAST' }, 400)
  }

  if (typeof duration_minutes !== 'number' || duration_minutes < 15 || duration_minutes > 240) {
    return c.json({ error: 'Duration must be between 15 and 240 minutes', code: 'INVALID_DURATION' }, 400)
  }

  if (user.role === 'tutor' && tutor_id !== user.id) {
    return c.json({ error: 'Tutors can only schedule classes for themselves', code: 'FORBIDDEN' }, 403)
  }

  // Ensure the tutor is assigned to the course and belongs to the school
  const { data: assignment, error: assignmentError } = await supabase
    .from('tutor_course_assignments')
    .select('course_id')
    .eq('tutor_id', tutor_id)
    .eq('course_id', course_id)
    .eq('school_id', user.school_id)
    .maybeSingle()

  if (assignmentError || !assignment) {
    return c.json({ error: 'Tutor is not assigned to this course or course does not exist', code: 'INVALID_TUTOR_OR_COURSE' }, 403)
  }


  const { data, error } = await supabase
    .from('live_classes')
    .insert({
      school_id: user.school_id,
      course_id,
      tutor_id,
      title,
      scheduled_at,
      duration_minutes,
      status: 'scheduled',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('[live-classes] insert error:', error)
    return c.json({ error: 'Failed to schedule class' }, 500)
  }

  return c.json({ data }, 201)
})

// ── GET /live-classes — List classes (role-filtered) ───────────────────────

liveClassesRouter.get('/', async (c) => {
  const user = c.get('user')
  const { course_id, status } = c.req.query()

  let query = supabase
    .from('live_classes')
    .select('id, title, scheduled_at, duration_minutes, status, started_at, ended_at, course_id, tutor_id, course:courses(id, name), tutor:user_profiles!live_classes_tutor_id_fkey(id, first_name, last_name)')
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

  return c.json({ data })
})

// ── GET /live-classes/:id — Get single class ───────────────────────────────

liveClassesRouter.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  const { data, error } = await supabase
    .from('live_classes')
    .select('*')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (error || !data) {
    return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)
  }

  if (user.role === 'student' && !(await studentCanAccessCourse(user.id, user.school_id!, data.course_id))) {
    return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json({ data })
})

// ── PATCH /live-classes/:id — Update a scheduled class (Admin, Tutor) ──────

liveClassesRouter.patch('/:id', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const body = await c.req.json()

  const { data: existing, error: fetchError } = await supabase
    .from('live_classes')
    .select('status, tutor_id, scheduled_at')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError || !existing) {
    return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)
  }

  if (existing.status !== 'scheduled') {
    return c.json({ error: 'Only scheduled classes can be updated', code: 'CLASS_NOT_EDITABLE' }, 409)
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

  const { data: liveClass, error: fetchError } = await supabase
    .from('live_classes')
    .select('*, school:schools(name)')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError || !liveClass) return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)
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

  const { data: liveClass, error: fetchError } = await supabase
    .from('live_classes')
    .select('*, courses(name, code)')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError || !liveClass) {
    return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)
  }

  if (liveClass.tutor_id !== user.id) {
    return c.json({ error: 'You are not the tutor for this class', code: 'NOT_CLASS_TUTOR' }, 403)
  }

  if (liveClass.status === 'live') {
    // If the tutor refreshes the page, the class is already live. Just let them back in!
    const roomName = liveClass.livekit_room_name || `kanvise-class-${id}`
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.kanvise_user_id || 'Tutor'
    const token = await generateToken(user.id, displayName, roomName, true, await getAvatarConfig(user.id, user.school_id))
    const { wsUrl } = getLiveKitConfig()
    return c.json({ data: {
      livekit_room_name: roomName,
      access_token: token,
      livekit_url: wsUrl,
      is_host: true,
      class_title: liveClass.title,
      course_name: (liveClass.courses as any)?.name || null,
      course_code: (liveClass.courses as any)?.code || null,
    } })
  }

  if (liveClass.status !== 'scheduled') {
    return c.json({ error: 'Only scheduled classes can be started', code: 'CLASS_NOT_SCHEDULED' }, 400)
  }

  const roomName = `kanvise-class-${id}`

  try {
    const roomService = getRoomService()
    await roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 200 })
  } catch (e) {
    console.error('[live-classes] createRoom error:', e)
    return c.json({ error: 'Failed to create LiveKit room' }, 500)
  }

  await supabase
    .from('live_classes')
    .update({ status: 'live', livekit_room_name: roomName, started_at: new Date().toISOString() })
    .eq('id', id)

  const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.kanvise_user_id || 'Tutor'
  const token = await generateToken(user.id, displayName, roomName, true, await getAvatarConfig(user.id, user.school_id))
  const { wsUrl } = getLiveKitConfig()

  return c.json({ data: {
    livekit_room_name: roomName,
    access_token: token,
    livekit_url: wsUrl,
    is_host: true,
    class_title: liveClass.title,
    course_name: (liveClass.courses as any)?.name || null,
    course_code: (liveClass.courses as any)?.code || null,
  } })
})

// ── POST /live-classes/:id/join — Participant joins a class ───────────────

// TODO(auth): Remove 'admin' role bypass after MVP testing is complete
liveClassesRouter.post('/:id/join', requireRole('tutor', 'student', 'admin'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  const { data: liveClass, error: fetchError } = await supabase
    .from('live_classes')
    .select('*, courses(name, code)')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError || !liveClass) {
    return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)
  }

  if (user.role === 'student' && !(await studentCanAccessCourse(user.id, user.school_id!, liveClass.course_id))) {
    return c.json({ error: 'You are not enrolled in this class', code: 'NOT_ENROLLED' }, 403)
  }

  if (liveClass.status !== 'live') {
    return c.json({ error: 'Class is not currently live', code: 'CLASS_NOT_LIVE' }, 404)
  }

  // The assigned tutor (whether admin or tutor role) gets host permissions
  const isHost = liveClass.tutor_id === user.id
  const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.kanvise_user_id || 'Participant'
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
      course_code: (liveClass.courses as any)?.code || null,
    },
  })
})

// ── POST /live-classes/:id/end — Tutor ends a class ──────────────────────

liveClassesRouter.post('/:id/end', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  const { data: liveClass, error: fetchError } = await supabase
    .from('live_classes')
    .select('*')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError || !liveClass) {
    return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)
  }

  if (liveClass.status !== 'live') {
    return c.json({ error: 'Class is not currently live', code: 'CLASS_NOT_LIVE' }, 400)
  }

  try {
    const roomService = getRoomService()
    await roomService.deleteRoom(liveClass.livekit_room_name)
  } catch (e) {
    // Room may have already been deleted (e.g. everyone left) — log and continue
    console.warn('[live-classes] deleteRoom warning (may already be gone):', e)
  }

  await supabase
    .from('live_classes')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', id)

  return c.json({ message: 'Live class ended' })
})

// ── POST /live-classes/:id/host-action — Kick / Mute / Lower hand ─────────

// TODO(auth): Remove 'admin' role bypass after MVP testing is complete
liveClassesRouter.post('/:id/host-action', requireRole('tutor', 'admin'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const { action, identity, trackSid } = await c.req.json()

  const { data: liveClass, error: fetchError } = await supabase
    .from('live_classes')
    .select('tutor_id, livekit_room_name, status')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError || !liveClass) {
    return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)
  }

  if (liveClass.tutor_id !== user.id) {
    return c.json({ error: 'You are not the tutor for this class', code: 'NOT_CLASS_TUTOR' }, 403)
  }

  if (liveClass.status !== 'live') {
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
