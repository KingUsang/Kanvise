// AWS Lambda Function URL handler for the one Kanvise recorder EC2 instance.
// It has no create/delete permission: it can only start or stop the explicit
// instance ID. A request for any non-zero capacity means "run the worker".
import { createHmac, timingSafeEqual } from 'node:crypto'
import { EC2Client, StartInstancesCommand, StopInstancesCommand, DescribeInstancesCommand } from '@aws-sdk/client-ec2'

const client = new EC2Client({})
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
  if (input.action !== 'set_capacity' || !Number.isInteger(capacity) || capacity < 0 || capacity > 2 || !instanceId) return { statusCode: 400, body: 'Invalid capacity request' }
  const result = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }))
  const before = result.Reservations?.[0]?.Instances?.[0]?.State?.Name || 'unknown'
  if (capacity > 0 && ['stopped', 'stopping'].includes(before)) await client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }))
  if (capacity === 0 && ['running', 'pending'].includes(before)) await client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }))
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ desired_capacity: capacity, instance_id: instanceId, state_before: before }) }
}
