import { createHmac, timingSafeEqual } from 'node:crypto'
import { supabase } from '../lib/supabase'

type FleetAction = { action: 'set_capacity'; desired_capacity: number; reason: string; requested_at: string }
type FleetControllerResult = { state_before?: string }

function configured() {
  return process.env.RECORDER_FLEET_ENABLED === 'true'
    && Boolean(process.env.RECORDER_FLEET_CONTROLLER_URL && process.env.RECORDER_FLEET_CONTROLLER_SECRET)
}

function sign(body: string) {
  return createHmac('sha256', process.env.RECORDER_FLEET_CONTROLLER_SECRET || '').update(body).digest('hex')
}

/**
 * Keep the single recorder instance warm from T-10 until 45 minutes after a
 * class has completed. Its capture service accepts two concurrent rooms; its
 * transcode service is intentionally serial. The controller receives 0 or 1
 * because this deployment is a direct EC2 instance, not an Auto Scaling Group.
 */
export async function reconcileRecorderFleet(now = new Date()) {
  if (!configured()) return { name: 'recorder_fleet', skipped: true, desiredCapacity: 0 }
  const warmFrom = now.toISOString()
  const warmTo = new Date(now.getTime() + 10 * 60_000).toISOString()
  const { data, error } = await (supabase as any).from('live_classes')
    .select('id, status, scheduled_at, ended_at')
    .eq('classroom_provider', 'plugnmeet')
    .not('course_id', 'is', null)
    .or(`and(status.eq.scheduled,scheduled_at.gte.${warmFrom},scheduled_at.lte.${warmTo}),status.eq.live`)
  if (error) throw error
  const activeWindows = data || []
  const desiredCapacity = activeWindows.length ? 1 : 0
  const payload: FleetAction = {
    action: 'set_capacity', desired_capacity: desiredCapacity,
    reason: desiredCapacity ? 'scheduled_or_active_enrolled_recordings' : 'no_recording_windows', requested_at: now.toISOString(),
  }
  const body = JSON.stringify(payload)
  const response = await fetch(process.env.RECORDER_FLEET_CONTROLLER_URL!, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kanvise-Recorder-Fleet-Signature': sign(body) }, body,
  })
  if (!response.ok) throw new Error(`Recorder fleet controller failed (${response.status})`)
  const controller = await response.json().catch(() => ({})) as FleetControllerResult
  // Do not overwrite the original clock on every scheduler reconciliation.
  // A stopped worker becoming requested is the beginning of a measurable boot.
  if (desiredCapacity > 0 && ['stopped', 'stopping'].includes(controller.state_before || '')) {
    const { error: readinessError } = await (supabase as any).from('recorder_fleet_readiness').upsert({
      singleton: true, vm_state: 'starting', service_state: 'starting', start_requested_at: now.toISOString(),
      vm_running_at: null, service_healthy_at: null, last_heartbeat_at: null, updated_at: now.toISOString(),
    }, { onConflict: 'singleton' })
    if (readinessError) throw readinessError
  }
  if (desiredCapacity === 0 && ['running', 'pending'].includes(controller.state_before || '')) {
    await (supabase as any).from('recorder_fleet_readiness').upsert({ singleton: true, vm_state: 'stopped', service_state: 'unknown', updated_at: now.toISOString() }, { onConflict: 'singleton' })
  }
  return { name: 'recorder_fleet', desiredCapacity, activeWindows: activeWindows.map((row: any) => row.id), captureCapacity: 2,
    capacityWarning: activeWindows.length > 2 ? 'More than two overlapping recording windows require another recorder instance.' : undefined }
}

/**
 * Recording becomes trustworthy only once PlugNmeet has emitted
 * `recording_proceeded` for this class. VM state alone is deliberately not a
 * readiness signal: it was the source of the earlier recording-bot race.
 */
export async function recorderReadyForClass(classId: string) {
  const { data, error } = await (supabase as any).from('live_class_recording_segments')
    .select('id').eq('live_class_id', classId).eq('status', 'pending').maybeSingle()
  if (error) throw error
  return Boolean(data)
}

// Exported for the controller's contract tests and to keep webhook secrets
// separate from the recorder-to-R2 callback credential.
export function verifyRecorderFleetSignature(body: string, supplied: string | null, secret = process.env.RECORDER_FLEET_CONTROLLER_SECRET || '') {
  if (!supplied || !secret) return false
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
}
