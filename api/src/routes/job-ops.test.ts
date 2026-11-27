import { beforeEach, describe, expect, it, vi } from 'vitest'

const ACCOUNT = '11111111-1111-4111-8111-111111111111'
const OTHER = '99999999-9999-4999-8999-999999999999'
const JOB = '22222222-2222-4222-8222-222222222222'

const mocks = vi.hoisted(() => ({
  role: 'admin' as string,
  getDurableJob: vi.fn(),
  cancel: vi.fn(),
  replay: vi.fn(),
  list: vi.fn(),
}))

vi.mock('../jobs/durable-jobs', () => ({
  durableJobStore: { cancel: mocks.cancel, replay: mocks.replay },
  getDurableJob: mocks.getDurableJob,
  listDeadLetterJobs: mocks.list,
  jobAccountId: (payload: any) => payload?.schoolId ?? payload?.school_id ?? null,
}))
vi.mock('../middleware/account-projection', () => ({ accountUserProjection: async (_c: any, next: () => Promise<void>) => next() }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (c: any, next: () => Promise<void>) => {
    if (!c.req.header('Authorization')) return c.json({ code: 'MISSING_AUTH' }, 401)
    await next()
  },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', { id: 'u1' }); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('account', { id: ACCOUNT, membershipId: 'm1', role: mocks.role })
    await next()
  },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('account').role)) return c.json({ code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
}))

import { jobOpsRouter } from './job-ops'

const auth = { Authorization: 'Bearer t' }
const post = (path: string, headers: Record<string, string> = auth) => jobOpsRouter.request(path, { method: 'POST', headers })

describe('job ops routes (DEV-INT-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.role = 'admin'
    mocks.getDurableJob.mockResolvedValue({ id: JOB, job_type: 'x', status: 'failed', payload: { schoolId: ACCOUNT } })
    mocks.cancel.mockResolvedValue(true)
    mocks.replay.mockResolvedValue(true)
    mocks.list.mockResolvedValue([{ id: JOB, job_type: 'x', dedupe_key: 'secret-key', attempts: 5, max_attempts: 5, last_error: 'boom', updated_at: 'now' }])
  })

  it.each(['cancel', 'replay'])('%s requires authentication', async (action) => {
    expect((await post(`/${JOB}/${action}`, {})).status).toBe(401)
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(mocks.replay).not.toHaveBeenCalled()
  })

  it.each(['tutor', 'learner'])('rejects a %s member with 403', async (role) => {
    mocks.role = role
    expect((await post(`/${JOB}/cancel`)).status).toBe(403)
    expect((await post(`/${JOB}/replay`)).status).toBe(403)
    expect((await jobOpsRouter.request('/dead-letter', { headers: auth })).status).toBe(403)
    expect(mocks.getDurableJob).not.toHaveBeenCalled()
  })

  it.each([
    ['cancel', 'cancelled'],
    ['replay', 'pending'],
  ])('%s succeeds for a job of the selected account', async (action, status) => {
    const res = await post(`/${JOB}/${action}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: JOB, action, status })
    expect(mocks[action as 'cancel' | 'replay']).toHaveBeenCalledWith(JOB)
  })

  it.each(['cancel', 'replay'])('%s answers 404 for another account, an unattributed job and a missing job', async (action) => {
    for (const found of [
      { id: JOB, job_type: 'x', status: 'failed', payload: { schoolId: OTHER } },
      { id: JOB, job_type: 'x', status: 'failed', payload: { presentationId: 'p' } },
      null,
    ]) {
      mocks.getDurableJob.mockResolvedValueOnce(found)
      const res = await post(`/${JOB}/${action}`)
      expect(res.status).toBe(404)
      expect(await res.json()).toMatchObject({ code: 'NOT_FOUND' })
    }
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(mocks.replay).not.toHaveBeenCalled()
  })

  it('answers 409 when the job is not in an operable state', async () => {
    mocks.cancel.mockResolvedValueOnce(false)
    const res = await post(`/${JOB}/cancel`)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'JOB_STATE_CONFLICT' })
  })

  it('rejects a malformed job id before any lookup', async () => {
    const res = await post('/not-a-uuid/cancel')
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.getDurableJob).not.toHaveBeenCalled()
  })

  it('lists dead-letter jobs scoped to the account without dedupe keys', async () => {
    const res = await jobOpsRouter.request('/dead-letter', { headers: auth })
    expect(res.status).toBe(200)
    expect(mocks.list).toHaveBeenCalledWith(50, ACCOUNT)
    const body = await res.json() as any
    expect(body.jobs).toHaveLength(1)
    expect(body.jobs[0]).not.toHaveProperty('dedupe_key')
  })
})
