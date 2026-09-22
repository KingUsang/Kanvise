// AWS Lambda Function URL handler. It changes only the desired capacity of
// one pre-created Auto Scaling Group; it cannot create arbitrary EC2 servers.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { AutoScalingClient, SetDesiredCapacityCommand } from '@aws-sdk/client-auto-scaling'

const client = new AutoScalingClient({})
const secret = process.env.RECORDER_FLEET_CONTROLLER_SECRET || ''
const group = process.env.RECORDER_ASG_NAME || ''

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
  if (input.action !== 'set_capacity' || !Number.isInteger(capacity) || capacity < 0 || capacity > 20 || !group) return { statusCode: 400, body: 'Invalid capacity request' }
  await client.send(new SetDesiredCapacityCommand({ AutoScalingGroupName: group, DesiredCapacity: capacity, HonorCooldown: false }))
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ desired_capacity: capacity }) }
}
