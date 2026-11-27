import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { supabase } from '../lib/supabase'

type FleetAction = {
  action: 'set_capacity'; desired_capacity: number; reason: string; requested_at: string
  command_id: string; version: number
}
type FleetControllerResult = { state_before?: string }

// The recorder instance has two concurrent capture slots (DEV-REC-002).
export const RECORDER_CAPTURE_SLOTS = 2
// An unchanged desired state is re-sent this often so a crashed or stopped
// instance is still recovered, and acknowledgements stay fresh.
export const RECORDER_REFRESH_SECONDS = 600

function configured() {
  return process.env.RECORDER_FLEET_ENABLED === 'true'
    && Boolean(process.env.RECORDER_FLEET_CONTROLLER_URL && process.env.RECORDER_FLEET_CONTROLLER_SECRET)
}

function sign(body: string) {
  return createHmac('sha256', process.env.RECORDER_FLEET_CONTROLLER_SECRET || '').update(body).digest('hex')
}

/** Freshness-bound signature: covers a timestamp and single-use nonce as well as the body (DEV-REC-005). */
export function signFresh(body: string, timestamp: string, nonce: string, secret = process.env.RECORDER_FLEET_CONTROLLER_SECRET || '') {
  return createHmac('sha256', secret).update(`v2.${timestamp}.${nonce}.${body}`).digest('hex')
}

// Rollout: the API sends the legacy body-only signature as well, so a controller
// that has not been upgraded keeps working. Set to 'false' once the controller
// requires freshness (RECORDER_FLEET_REQUIRE_FRESHNESS=true).
function sendLegacySignature() {
  return process.env.RECORDER_FLEET_SEND_LEGACY_SIGNATURE !== 'false'
}

function requestHeaders(body: string, now: Date) {
  const timestamp = String(Math.floor(now.getTime() / 1000))
  const nonce = randomUUID()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Kanvise-Recorder-Fleet-Timestamp': timestamp,
    'X-Kanvise-Recorder-Fleet-Nonce': nonce,
    'X-Kanvise-Recorder-Fleet-Signature-V2': signFresh(body, timestamp, nonce),
  }
  if (sendLegacySignature()) headers['X-Kanvise-Recorder-Fleet-Signature'] = sign(body)
  return headers
}

/**
 * Keep the single recorder instance warm from T-10 until 45 minutes after a
 * class has completed. Its capture service accepts two concurrent rooms; its
 * transcode service is intentionally serial. The controller receives 0 or 1
 * because this deployment is a direct EC2 instance, not an Auto Scaling Group.
 */
export async function reconcileRecorderFleet(now = new Date(), options: { force?: boolean } = {}) {
  if (!configured()) return { name: 'recorder_fleet', skipped: true, desiredCapacity: 0 }
  const warmFrom = now.toISOString()
  const warmTo = new Date(now.getTime() + 10 * 60_000).toISOString()
  // Keep the recorder up while uploads and merges finish after a class ends.
  const cooldownFrom = new Date(now.getTime() - 45 * 60_000).toISOString()
  const { data, error } = await (supabase as any).from('live_classes')
    .select('id, status, scheduled_at, ended_at')
    .eq('classroom_provider', 'plugnmeet')
    .or(`and(status.eq.scheduled,scheduled_at.gte.${warmFrom},scheduled_at.lte.${warmTo}),status.in.(starting,ready,live,ending),and(status.eq.completed,ended_at.gte.${cooldownFrom}))`)
  if (error) throw error
  const activeWindows = data || []
  const desiredCapacity = activeWindows.length ? 1 : 0
  const reason = desiredCapacity ? 'scheduled_or_active_enrolled_recordings' : 'no_recording_windows'

  // Persist the desired state and demand first (DEV-REC-002, DEV-REC-003). The
  // database decides whether a command is needed. Until one caller acknowledges,
  // concurrent API processes may each send the same command; the controller's
  // version check makes that harmless.
  const { data: plans, error: planError } = await (supabase as any).rpc('plan_recorder_command', {
    p_desired: desiredCapacity, p_demand: activeWindows.length, p_reason: reason,
    p_capture_slots: RECORDER_CAPTURE_SLOTS, p_refresh_seconds: RECORDER_REFRESH_SECONDS, p_force: Boolean(options.force),
  })
  if (planError) throw planError
  const plan = (Array.isArray(plans) ? plans[0] : plans) as { out_command_id: string; out_version: number; out_send: boolean; out_capacity_alert: boolean } | undefined
  if (!plan) throw new Error('Recorder desired state could not be persisted')
  const capacityWarning = activeWindows.length > RECORDER_CAPTURE_SLOTS
    ? 'More than two overlapping recording windows require another recorder instance.' : undefined
  if (plan.out_capacity_alert) {
    console.error('recorder_fleet.capacity_exceeded', {
      demand: activeWindows.length, captureSlots: RECORDER_CAPTURE_SLOTS, classIds: activeWindows.map((row: any) => row.id),
    })
  }
  const summary = { name: 'recorder_fleet', desiredCapacity, activeWindows: activeWindows.map((row: any) => row.id),
    captureCapacity: RECORDER_CAPTURE_SLOTS, capacityWarning, version: plan.out_version }
  if (!plan.out_send) return { ...summary, commandSent: false }

  const payload: FleetAction = {
    action: 'set_capacity', desired_capacity: desiredCapacity, reason, requested_at: now.toISOString(),
    command_id: plan.out_command_id, version: Number(plan.out_version),
  }
  const body = JSON.stringify(payload)
  const response = await fetch(process.env.RECORDER_FLEET_CONTROLLER_URL!, {
    method: 'POST', headers: requestHeaders(body, now), body,
    signal: AbortSignal.timeout(15_000),
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
    const { error: stoppedError } = await (supabase as any).from('recorder_fleet_readiness').upsert({ singleton: true, vm_state: 'stopped', service_state: 'unknown', updated_at: now.toISOString() }, { onConflict: 'singleton' })
    if (stoppedError) throw stoppedError
  }
  // Acknowledge last: a failure above leaves the command unacknowledged so the next tick resends it.
  const { error: ackError } = await (supabase as any).rpc('acknowledge_recorder_command', {
    p_command_id: plan.out_command_id, p_version: Number(plan.out_version),
  })
  if (ackError) throw ackError
  return { ...summary, commandSent: true }
}

export const RECORDING_CAPACITY_EXCEEDED = 'RECORDING_CAPACITY_EXCEEDED'
export type RecordingAdmission = { admitted: true } | { admitted: false; code: typeof RECORDING_CAPACITY_EXCEEDED; message: string }

/**
 * Admission control for recording (DEV-REC-002). The recorder has
 * RECORDER_CAPTURE_SLOTS concurrent capture slots; if that many other classes
 * already hold a room, a new class still runs but with recording disabled.
 * Only classes whose rooms are open count: scheduled and cooling-down classes
 * do not capture. Fails open so a lookup error never blocks a class.
 */
export async function recordingAdmission(classId: string): Promise<RecordingAdmission> {
  if (!configured()) return { admitted: true }
  try {
    const { data, error } = await (supabase as any).from('live_classes')
      .select('id')
      .eq('classroom_provider', 'plugnmeet')
      .in('status', ['starting', 'ready', 'live', 'ending'])
      .neq('id', classId)
      .limit(RECORDER_CAPTURE_SLOTS + 1)
    if (error) throw error
    if ((data || []).length >= RECORDER_CAPTURE_SLOTS) {
      console.error('recorder_fleet.admission_denied', { classId, otherActiveClasses: (data || []).map((row: any) => row.id), captureSlots: RECORDER_CAPTURE_SLOTS })
      return { admitted: false, code: RECORDING_CAPACITY_EXCEEDED, message: 'Recording is unavailable for this class because the recorder is at capacity. The class can continue without recording.' }
    }
  } catch (error) {
    console.warn('recorder_fleet.admission_check_failed', error)
  }
  return { admitted: true }
}

export async function recorderFleetReadiness(now = new Date()) {
  if (!configured()) return { state: 'unavailable' as const, message: 'Recording is not configured.' }
  const { data, error } = await (supabase as any).from('recorder_fleet_readiness')
    .select('vm_state, service_state, last_heartbeat_at')
    .eq('singleton', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return { state: 'starting' as const, message: 'The recorder is starting.' }
  const heartbeatAt = data.last_heartbeat_at ? new Date(data.last_heartbeat_at).getTime() : 0
  const heartbeatFresh = heartbeatAt > now.getTime() - 3 * 60_000
  if (data.vm_state === 'running' && data.service_state === 'healthy' && heartbeatFresh) {
    return { state: 'ready' as const }
  }
  if (['starting', 'pending', 'running'].includes(String(data.vm_state))) {
    return { state: 'starting' as const, message: 'The recorder is starting.' }
  }
  return { state: 'unavailable' as const, message: 'Recording is unavailable. You can continue the class.' }
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
