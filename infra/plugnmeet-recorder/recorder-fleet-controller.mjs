// AWS Lambda Function URL handler for the one Kanvise recorder EC2 instance.
// It has no create/delete permission: it can start the explicit instance and
// switch only that recorder's services through SSM.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { EC2Client, StartInstancesCommand, DescribeInstancesCommand } from '@aws-sdk/client-ec2'
import { SSMClient, SendCommandCommand } from '@aws-sdk/client-ssm'

const client = new EC2Client({})
const ssm = new SSMClient({})
const secret = process.env.RECORDER_FLEET_CONTROLLER_SECRET || ''
const instanceId = process.env.RECORDER_INSTANCE_ID || ''

const MAX_SKEW_SECONDS = 300
const seenNonces = new Map()
let highestVersion = 0

function safeEqual(supplied, expected) {
  return Boolean(supplied && supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
}

// Authenticate a request and bound its lifetime (DEV-REC-005).
// - Fresh requests carry a timestamp and nonce under a v2 signature: stale
//   timestamps and repeated nonces are rejected. The nonce cache lives in the
//   warm Lambda container only, so the timestamp window is the hard bound.
// - Legacy body-only signatures stay accepted until RECORDER_FLEET_REQUIRE_FRESHNESS=true,
//   so the controller can be deployed before the API is upgraded.
export function authenticate({ body, headers, secret, nowSeconds, requireFresh }) {
  if (!secret) return { ok: false, status: 401 }
  const timestamp = headers['x-kanvise-recorder-fleet-timestamp']
  const nonce = headers['x-kanvise-recorder-fleet-nonce']
  const v2 = headers['x-kanvise-recorder-fleet-signature-v2']
  if (timestamp && nonce && v2) {
    const expected = createHmac('sha256', secret).update(`v2.${timestamp}.${nonce}.${body}`).digest('hex')
    if (!safeEqual(v2, expected)) return { ok: false, status: 401 }
    const issuedAt = Number(timestamp)
    if (!Number.isInteger(issuedAt) || Math.abs(nowSeconds - issuedAt) > MAX_SKEW_SECONDS) return { ok: false, status: 401, reason: 'stale' }
    for (const [seen, expiresAt] of seenNonces) if (expiresAt < nowSeconds) seenNonces.delete(seen)
    if (seenNonces.has(nonce)) return { ok: false, status: 401, reason: 'replay' }
    seenNonces.set(nonce, nowSeconds + 2 * MAX_SKEW_SECONDS)
    return { ok: true, fresh: true }
  }
  if (requireFresh) return { ok: false, status: 401, reason: 'freshness_required' }
  const legacy = headers['x-kanvise-recorder-fleet-signature']
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return safeEqual(legacy, expected) ? { ok: true, fresh: false } : { ok: false, status: 401 }
}

// A command older than one already applied must not undo it.
export function isStaleVersion(version) {
  if (!Number.isInteger(version)) return false
  if (version < highestVersion) return true
  highestVersion = version
  return false
}

export function resetControllerStateForTests() {
  seenNonces.clear()
  highestVersion = 0
}

export const handler = async (event) => {
  const body = event.body || ''
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value]))
  const auth = authenticate({ body, headers, secret, nowSeconds: Math.floor(Date.now() / 1000), requireFresh: process.env.RECORDER_FLEET_REQUIRE_FRESHNESS === 'true' })
  if (!auth.ok) return { statusCode: auth.status, body: 'Unauthorized' }
  let input
  try { input = JSON.parse(body) } catch { return { statusCode: 400, body: 'Invalid JSON' } }
  if (isStaleVersion(input.version)) return { statusCode: 409, body: 'Stale command' }
  const capacity = Number(input.desired_capacity)
  if (input.action !== 'set_capacity' || !Number.isInteger(capacity) || capacity < 0 || !instanceId) return { statusCode: 400, body: 'Invalid capacity request' }
  const result = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }))
  const before = result.Reservations?.[0]?.Instances?.[0]?.State?.Name || 'unknown'
  if (capacity > 0 && ['stopped', 'stopping'].includes(before)) {
    await client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }))
    return { statusCode: 202, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ command_id: input.command_id, version: input.version, desired_capacity: capacity, instance_id: instanceId, state_before: before, action: 'starting_capture_worker' }) }
  }
  if (before !== 'running') return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ command_id: input.command_id, version: input.version, desired_capacity: capacity, instance_id: instanceId, state_before: before, action: 'no_action' }) }

  // Capture and transcoding intentionally never run together on this 2-vCPU
  // machine. Keep capture enabled while stopping it for transcoding: the next
  // EC2 cold boot must start capture before SSM is online and able to receive
  // a follow-up command.
  const commands = capacity > 0
    ? ['systemctl stop kanvise-recorder-idle-stop.service || true', 'systemctl stop plugnmeet-recorder-transcoder.service || true', 'systemctl enable --now plugnmeet-recorder-capture.service']
    : ['systemctl stop plugnmeet-recorder-capture.service || true', 'systemctl start plugnmeet-recorder-transcoder.service || true', 'systemctl is-active --quiet kanvise-recorder-idle-stop.service || systemctl start kanvise-recorder-idle-stop.service']
  await ssm.send(new SendCommandCommand({
    InstanceIds: [instanceId], DocumentName: 'AWS-RunShellScript',
    Parameters: { commands }, TimeoutSeconds: 60,
  }))
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ command_id: input.command_id, version: input.version, desired_capacity: capacity, instance_id: instanceId, state_before: before, action: capacity > 0 ? 'capture_enabled' : 'transcode_then_idle_stop' }) }
}
