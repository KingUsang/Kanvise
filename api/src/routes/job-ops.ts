import { Hono } from 'hono'
import { apiError, uuidParam } from '../lib/api-contract'
import { accountUserProjection } from '../middleware/account-projection'
import { accountContextMiddleware, jwtVerificationMiddleware, profileResolutionMiddleware, requireMembershipRole } from '../middleware/auth'
import { durableJobStore, getDurableJob, jobAccountId, listDeadLetterJobs } from '../jobs/durable-jobs'
import type { AccountContext } from '../types'

/**
 * Operator endpoints for durable jobs, mounted at /admin/jobs. Admin members
 * only, and only for jobs whose payload names the caller's selected account.
 * Jobs of other accounts, and jobs with no account in the payload, answer 404 so
 * job ids cannot be probed across accounts.
 */
export const jobOpsRouter = new Hono<{ Variables: { user: any; jwt_payload?: any; account: AccountContext } }>()

jobOpsRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware)
jobOpsRouter.use('*', accountContextMiddleware, accountUserProjection)
jobOpsRouter.use('*', requireMembershipRole('admin'))

jobOpsRouter.get('/dead-letter', async (c) => {
  const account = c.get('account')
  const jobs = await listDeadLetterJobs(50, account.id)
  return c.json({ jobs: jobs.map(({ dedupe_key: _dedupeKey, ...job }) => job) })
})

async function operate(c: any, action: 'cancel' | 'replay') {
  const account = c.get('account') as AccountContext
  const id = c.req.param('id') as string
  const job = await getDurableJob(id)
  if (!job || jobAccountId(job.payload) !== account.id) {
    return apiError(c, 404, 'NOT_FOUND', 'Job not found.')
  }
  const operation = durableJobStore[action]
  if (!operation) return apiError(c, 501, 'NOT_SUPPORTED', 'This operation is not available.')
  const changed = await operation.call(durableJobStore, id)
  if (!changed) {
    return apiError(c, 409, 'JOB_STATE_CONFLICT', `The job cannot be ${action === 'cancel' ? 'cancelled' : 'replayed'} in its current state.`)
  }
  return c.json({ id, action, status: action === 'cancel' ? 'cancelled' : 'pending' })
}

jobOpsRouter.post('/:id/cancel', uuidParam('id'), (c) => operate(c, 'cancel'))
jobOpsRouter.post('/:id/replay', uuidParam('id'), (c) => operate(c, 'replay'))
