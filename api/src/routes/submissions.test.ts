import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  notify: vi.fn(),
  account: { id: 'school-1', membershipId: 'membership-1', role: 'tutor' } as any,
  user: { id: 'tutor-1', school_id: 'school-1', role: 'tutor' },
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../notifications/triggers', () => ({ notifySubmissionGraded: mocks.notify }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { if (mocks.account) c.set('account', mocks.account); await next() },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('account')?.role)) return c.json({ error: 'forbidden' }, 403)
    await next()
  },
}))

import { submissionsRouter } from './submissions'

function query(result: any) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    update: () => builder,
    single: async () => result,
  }
  return builder
}

describe('submission review account boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.account = { id: 'school-1', membershipId: 'membership-1', role: 'tutor' }
    mocks.notify.mockResolvedValue(null)
  })

  it('requires canonical active account context before reading a submission', async () => {
    mocks.account = null
    const response = await submissionsRouter.request('/submission-1/review', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score: 80 }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a safe retryable response for a dependency failure', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: { code: 'DB_DOWN', message: 'provider details' } }))
    const response = await submissionsRouter.request('/submission-1/review', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score: 80 }),
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Could not load this submission right now', code: 'SUBMISSION_LOOKUP_FAILED' })
  })

  it('distinguishes a missing submission from a failed lookup', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    const response = await submissionsRouter.request('/submission-1/review', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score: 80 }),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Submission not found', code: 'NOT_FOUND' })
  })
})
