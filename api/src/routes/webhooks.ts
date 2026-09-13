import { Hono } from 'hono'
import { handleSupabaseEmailHook } from './supabase-email-hook'
import { WebhookReceiver } from 'livekit-server-sdk'
import { supabase } from '../lib/supabase'

export const webhooksRouter = new Hono()

webhooksRouter.post('/supabase/send-email', (c) => handleSupabaseEmailHook(c.req.raw))

const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!,
)

// ── POST /webhooks/livekit ─────────────────────────────────────────────────
// Receives participant join/leave events from LiveKit and records attendance.
// This endpoint should only be reachable from the private Scaleway network
// where LiveKit is hosted. The LiveKit JWT in the Authorization header is
// verified by WebhookReceiver as a second layer of security.

webhooksRouter.post('/livekit', async (c) => {
  const body = await c.req.text()
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    console.error('[webhook/livekit] Missing Authorization header')
    return c.text('Unauthorized', 401)
  }

  let event: Awaited<ReturnType<typeof receiver.receive>>
  try {
    event = await receiver.receive(body, authHeader)
  } catch (e) {
    console.error('[webhook/livekit] Failed to verify webhook JWT:', e)
    return c.text('Invalid webhook signature', 401)
  }

  const roomName = event.room?.name

  if (!roomName) {
    // Not an event we care about (for example a server health event).
    return c.text('OK', 200)
  }

  // Resolve the live_class record from the room name
  const { data: liveClass, error: classError } = await supabase
    .from('live_classes')
    .select('id, school_id')
    .eq('livekit_room_name', roomName)
    .single()

  if (classError || !liveClass) {
    // Room may not be a managed class (e.g. dev/test room). Ignore silently.
    console.warn(`[webhook/livekit] No live_class found for room: ${roomName}`)
    return c.text('OK', 200)
  }

  if (event.event === 'room_finished') {
    // A tutor can lose power, close a browser, or leave without pressing End
    // class. LiveKit's room lifecycle is authoritative in those cases.
    const endedAt = new Date()
    const { data: openRecords, error: recordsError } = await supabase
      .from('attendance_records')
      .select('id, joined_at')
      .eq('live_class_id', liveClass.id)
      .is('left_at', null)

    if (recordsError) {
      console.error('[webhook/livekit] Failed to load open attendance records:', recordsError)
    } else {
      await Promise.all((openRecords || []).map((record) => supabase
        .from('attendance_records')
        .update({
          left_at: endedAt.toISOString(),
          duration_seconds: Math.max(0, Math.round((endedAt.getTime() - new Date(record.joined_at).getTime()) / 1000)),
        })
        .eq('id', record.id)))
    }

    const { error: completionError } = await supabase
      .from('live_classes')
      .update({ status: 'completed', ended_at: endedAt.toISOString() })
      .eq('id', liveClass.id)
      .neq('status', 'completed')

    if (completionError) console.error('[webhook/livekit] Failed to complete finished room:', completionError)
    else console.log(`[livekit] Room finished and class completed: ${liveClass.id}`)
    return c.text('OK', 200)
  }

  const identity = event.participant?.identity // This is the Kanvise user_id (set during token creation)
  if (!identity) return c.text('OK', 200)

  if (event.event === 'participant_joined') {
    const { error } = await supabase.from('attendance_records').insert({
      school_id: liveClass.school_id,
      live_class_id: liveClass.id,
      student_id: identity,
      joined_at: new Date(Number(event.participant?.joinedAt) * 1000 || Date.now()).toISOString(),
    })

    if (error) {
      console.error('[webhook/livekit] Failed to insert attendance record:', error)
    } else {
      console.log(`[attendance] Joined: ${identity} in class ${liveClass.id}`)
    }
  }

  if (event.event === 'participant_left') {
    const leftAt = new Date()

    // Find the most recent open attendance record for this participant
    const { data: record, error: fetchError } = await supabase
      .from('attendance_records')
      .select('id, joined_at')
      .eq('live_class_id', liveClass.id)
      .eq('student_id', identity)
      .is('left_at', null)
      .order('joined_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !record) {
      console.warn(`[webhook/livekit] No open attendance record for ${identity} in class ${liveClass.id}`)
      return c.text('OK', 200)
    }

    const durationSeconds = Math.round((leftAt.getTime() - new Date(record.joined_at).getTime()) / 1000)

    const { error: updateError } = await supabase
      .from('attendance_records')
      .update({
        left_at: leftAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('id', record.id)

    if (updateError) {
      console.error('[webhook/livekit] Failed to update attendance record:', updateError)
    } else {
      console.log(`[attendance] Left: ${identity} from class ${liveClass.id} (${durationSeconds}s)`)
    }
  }

  return c.text('OK', 200)
})
