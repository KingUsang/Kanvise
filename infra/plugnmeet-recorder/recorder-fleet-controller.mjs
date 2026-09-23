// AWS Lambda Function URL handler for the one Kanvise recorder EC2 instance.
// It has no create/delete permission: it can only start or stop the explicit
// instance ID. A request for any non-zero capacity means "run the worker".
import { createHmac, timingSafeEqual } from 'node:crypto'
import { EC2Client, StartInstancesCommand, DescribeInstancesCommand } from '@aws-sdk/client-ec2'
import { SSMClient, SendCommandCommand } from '@aws-sdk/client-ssm'

const client = new EC2Client({})
const ssm = new SSMClient({})
const secret = process.env.RECORDER_FLEET_CONTROLLER_SECRET || ''
const instanceId = process.env.RECORDER_INSTANCE_ID || ''

function valid(body, supplied) {
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return Boolean(secret && supplied && supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
}

export const handler = async (event) => {
  const body = event.body || ''
  if (!valid(body, event.headers?.['x-kanvise-recorder-fleet-signature'] || event.headers?.['X-Kanvise-Recorder-Fleet-Signature'])) return { statusCode: 401, body: 'Unauthorized' }
  let input
  try { input = JSON.parse(body) } catch { return { statusCode: 400, body: 'Invalid JSON' } }
  const capacity = Number(input.desired_capacity)
  if (input.action !== 'set_capacity' || !Number.isInteger(capacity) || capacity < 0 || !instanceId) return { statusCode: 400, body: 'Invalid capacity request' }
  const result = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }))
  const before = result.Reservations?.[0]?.Instances?.[0]?.State?.Name || 'unknown'
  if (capacity > 0 && ['stopped', 'stopping'].includes(before)) {
    await client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }))
    return { statusCode: 202, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ desired_capacity: capacity, instance_id: instanceId, state_before: before, action: 'starting_capture_worker' }) }
  }
  if (before !== 'running') return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ desired_capacity: capacity, instance_id: instanceId, state_before: before, action: 'no_action' }) }

  // Capture and transcoding intentionally never run together on this 2-vCPU
  // machine. The instance-local idle worker stops EC2 only after the serial
  // transcoder has had 15 quiet minutes, so R2 delivery is never cut short.
  const commands = capacity > 0
    ? ['systemctl stop kanvise-recorder-idle-stop.service || true', 'systemctl stop plugnmeet-recorder-transcoder.service || true', 'systemctl enable --now plugnmeet-recorder-capture.service']
    : ['systemctl disable --now plugnmeet-recorder-capture.service || true', 'systemctl start plugnmeet-recorder-transcoder.service || true', 'systemctl is-active --quiet kanvise-recorder-idle-stop.service || systemctl start kanvise-recorder-idle-stop.service']
  await ssm.send(new SendCommandCommand({
    InstanceIds: [instanceId], DocumentName: 'AWS-RunShellScript',
    Parameters: { commands }, TimeoutSeconds: 60,
  }))
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ desired_capacity: capacity, instance_id: instanceId, state_before: before, action: capacity > 0 ? 'capture_enabled' : 'transcode_then_idle_stop' }) }
}
