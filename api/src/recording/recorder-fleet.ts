import { createHmac, timingSafeEqual } from 'node:crypto'
import { supabase } from '../lib/supabase'

type FleetAction = { action: 'set_capacity'; desired_capacity: number; reason: string; requested_at: string }

function configured() {
  return process.env.RECORDER_FLEET_ENABLED === 'true'
    && Boolean(process.env.RECORDER_FLEET_CONTROLLER_URL && process.env.RECORDER_FLEET_CONTROLLER_SECRET)
}

function sign(body: string) {
  return createHmac('sha256', process.env.RECORDER_FLEET_CONTROLLER_SECRET || '').update(body).digest('hex')
}

/**
 * Keep the recorder fleet warm from T-10 until 45 minutes after a class has
 * completed. PlugNmeet load-balances rooms across the active recorders, so
 * capacity is the number of overlapping recording windows, not a fragile
 * class-to-instance assignment.
 */
export async function reconcileRecorderFleet(now = new Date()) {
  if (!configured()) return { name: 'recorder_fleet', skipped: true, desiredCapacity: 0 }
  const warmUntil = new Date(now.getTime() - 45 * 60_000).toISOString()
  const warmFrom = new Date(now.getTime() - 5 * 60_000).toISOString()
  const warmTo = new Date(now.getTime() + 10 * 60_000).toISOString()
  const { data, error } = await (supabase as any).from('live_classes')
    .select('id, status, scheduled_at, ended_at')
    .eq('classroom_provider', 'plugnmeet')
    .not('course_id', 'is', null)
    .or(`and(status.eq.scheduled,scheduled_at.gte.${warmFrom},scheduled_at.lte.${warmTo}),status.eq.live,and(status.eq.completed,ended_at.gte.${warmUntil})`)
  if (error) throw error
  const desiredCapacity = (data || []).length
  const payload: FleetAction = {
    action: 'set_capacity', desired_capacity: desiredCapacity,
    reason: desiredCapacity ? 'scheduled_or_active_enrolled_recordings' : 'no_recording_windows', requested_at: now.toISOString(),
  }
  const body = JSON.stringify(payload)
  const response = await fetch(process.env.RECORDER_FLEET_CONTROLLER_URL!, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kanvise-Recorder-Fleet-Signature': sign(body) }, body,
  })
  if (!response.ok) throw new Error(`Recorder fleet controller failed (${response.status})`)
  return { name: 'recorder_fleet', desiredCapacity, activeWindows: (data || []).map((row: any) => row.id) }
}

// Exported for the controller's contract tests and to keep webhook secrets
// separate from the recorder-to-R2 callback credential.
export function verifyRecorderFleetSignature(body: string, supplied: string | null, secret = process.env.RECORDER_FLEET_CONTROLLER_SECRET || '') {
  if (!supplied || !secret) return false
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
}
