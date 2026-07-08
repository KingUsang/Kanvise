import { Hono } from 'hono'
import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk'
import { supabase } from '../lib/supabase'
import {
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  tenantMiddleware,
  requireRole,
} from '../middleware/auth'

export const liveClassesRouter = new Hono()

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
): Promise<string> {
  const { apiKey, apiSecret } = getLiveKitConfig()
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    metadata: JSON.stringify({ isHost }),
  })
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
    roomAdmin: isHost,
  })
  return at.toJwt()
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
    .select('*')
    .eq('school_id', user.school_id)
    .order('scheduled_at', { ascending: true })

  if (user.role === 'tutor') {
    query = query.eq('tutor_id', user.id)
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

  return c.json({ data })
})

// ── PATCH /live-classes/:id — Update a scheduled class (Admin, Tutor) ──────

liveClassesRouter.patch('/:id', requireRole('admin', 'tutor'), async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const body = await c.req.json()

  const { data: existing, error: fetchError } = await supabase
    .from('live_classes')
    .select('status, tutor_id')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError || !existing) {
    return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)
  }

  if (existing.status === 'live' || existing.status === 'completed') {
    return c.json({ error: 'Cannot update a live or completed class', code: 'CLASS_NOT_EDITABLE' }, 409)
  }

  const { title, scheduled_at, duration_minutes } = body
  const { data, error } = await supabase
    .from('live_classes')
    .update({ title, scheduled_at, duration_minutes, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id)
    .select()
    .single()

  if (error) {
    return c.json({ error: 'Failed to update class' }, 500)
  }

  return c.json({ data })
})

// ── POST /live-classes/:id/start — Tutor starts a class ───────────────────

liveClassesRouter.post('/:id/start', requireRole('tutor'), async (c) => {
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

  if (liveClass.tutor_id !== user.id) {
    return c.json({ error: 'You are not the tutor for this class', code: 'NOT_CLASS_TUTOR' }, 403)
  }

  if (liveClass.status === 'live') {
    return c.json({ error: 'Class is already live', code: 'ALREADY_LIVE' }, 409)
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
  const token = await generateToken(user.id, displayName, roomName, true)
  const { wsUrl } = getLiveKitConfig()

  return c.json({ data: { livekit_room_name: roomName, access_token: token, livekit_url: wsUrl } })
})

// ── POST /live-classes/:id/join — Participant joins a class ───────────────

liveClassesRouter.post('/:id/join', requireRole('tutor', 'student'), async (c) => {
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
    return c.json({ error: 'Class is not currently live', code: 'CLASS_NOT_LIVE' }, 404)
  }

  // NOTE: Enrolment check is deliberately skipped for MVP while there are no real users.
  // TODO: Uncomment when enrolment data is populated.
  // if (user.role === 'student') { ... check enrolments table ... }

  // Tutors joining their own class get host permissions
  const isHost = user.role === 'tutor' && liveClass.tutor_id === user.id
  const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.kanvise_user_id || 'Participant'
  const token = await generateToken(user.id, displayName, liveClass.livekit_room_name, isHost)
  const { wsUrl } = getLiveKitConfig()

  return c.json({
    data: {
      livekit_room_name: liveClass.livekit_room_name,
      access_token: token,
      livekit_url: wsUrl,
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

liveClassesRouter.post('/:id/host-action', requireRole('tutor'), async (c) => {
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
