import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  sendEmail: vi.fn(async () => undefined),
  inserted: null as any,
  user: { id: 'person-1', school_id: 'legacy-account', role: 'admin', email: null, first_name: 'Admin' } as any,
  account: { id: 'account-1', membershipId: 'membership-1', role: 'admin' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../emails/config', () => ({ getEmailConfig: () => ({ from: 'noreply@example.com' }) }))
vi.mock('../emails/provider-router', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    if (!mocks.account) return c.json({ error: 'A valid tutoring account must be selected', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
    c.set('account', mocks.account)
    await next()
  },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('account')?.role)) return c.json({ error: 'Insufficient role', code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
}))

import { feedbackResolutionRouter, feedbackRouter } from './feedback'

function query(result: any) {
  const builder: any = {
    insert: vi.fn((value: any) => { mocks.inserted = value; return builder }),
    update: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(async () => result),
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

describe('feedback account policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.inserted = null
    mocks.user = { id: 'person-1', school_id: 'legacy-account', role: 'admin', email: null, first_name: 'Admin' }
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'admin' }
    process.env.KANVISE_INTERNAL_SECRET = 'feedback-test-secret'
  })

  it('requires a selected active account before creating feedback', async () => {
    mocks.account = null

    const response = await feedbackRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'feature', description: 'Improve the timetable' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('stores feedback in the selected account while retaining the verified person', async () => {
    mocks.from.mockReturnValue(query({ data: { id: 'report-1' }, error: null }))

    const response = await feedbackRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'focused-test' },
      body: JSON.stringify({ kind: 'feature', description: 'Improve the timetable' }),
    })

    expect(response.status).toBe(201)
    expect(mocks.inserted).toMatchObject({ reporter_id: 'person-1', school_id: 'account-1', kind: 'feature' })
    expect(mocks.inserted.school_id).not.toBe('legacy-account')
    expect(mocks.sendEmail).toHaveBeenCalled()
  })

  it('rejects an unsupported account capability before persistence', async () => {
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'super_admin' }

    const response = await feedbackRouter.request('/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'feature', description: 'Improve the timetable' }),
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'INSUFFICIENT_ROLE' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('maps persistence failure without exposing provider details', async () => {
    mocks.user.id = 'person-failure'
    mocks.from.mockReturnValue(query({ data: null, error: { message: 'secret database detail' } }))

    const response = await feedbackRouter.request('/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'feature', description: 'Improve the timetable' }),
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'We could not send your report. Please try again.', code: 'FEEDBACK_CREATE_FAILED' })
  })

  it('keeps signed public resolution separate from membership policy', async () => {
    const response = await feedbackResolutionRouter.request('/report-1/resolve?token=wrong')

    expect(response.status).toBe(403)
    expect(await response.text()).toBe('Invalid resolution link.')
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
