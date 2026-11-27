import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'admin-1', school_id: 'legacy-school', role: 'admin' } as any,
  account: { id: 'account-1', membershipId: 'membership-1', role: 'admin' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', mocks.user)
    await next()
  },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    if (mocks.account) c.set('account', mocks.account)
    await next()
  },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!mocks.account || !roles.includes(mocks.account.role)) {
      return c.json({ error: 'This action is not available for your account membership', code: 'INSUFFICIENT_ROLE' }, 403)
    }
    await next()
  },
}))

import { enrolmentsRouter } from './enrolments'

function query(result: any) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(async () => result),
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

describe('enrolment account policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'legacy-school', role: 'admin' }
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'admin' }
  })

  it('requires an active account before reading enrolments', async () => {
    mocks.account = null

    const response = await enrolmentsRouter.request('/')

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('uses the selected account rather than the profile school projection', async () => {
    const enrolmentQuery = query({ data: [{ id: 'enrolment-1' }], error: null })
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('enrolments')
      return enrolmentQuery
    })

    const response = await enrolmentsRouter.request('/?student_id=11111111-1111-4111-8111-111111111111')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [{ id: 'enrolment-1' }], pagination: { limit: 100, offset: 0, has_more: false } })
    expect(enrolmentQuery.eq).toHaveBeenCalledWith('school_id', 'account-1')
    expect(enrolmentQuery.eq).toHaveBeenCalledWith('student_id', '11111111-1111-4111-8111-111111111111')
  })

  it('rejects tutor membership before the admin-only read', async () => {
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'tutor' }

    const response = await enrolmentsRouter.request('/')

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'INSUFFICIENT_ROLE' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('pages enrolments with a bounded window and reports has_more', async () => {
    const rows = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]
    const enrolmentQuery = query({ data: rows, error: null })
    mocks.from.mockReturnValue(enrolmentQuery)

    const response = await enrolmentsRouter.request('/?limit=2&offset=4')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [{ id: 'e1' }, { id: 'e2' }], pagination: { limit: 2, offset: 4, has_more: true } })
    expect(enrolmentQuery.range).toHaveBeenCalledWith(4, 6)
  })

  it('rejects malformed filters before querying', async () => {
    for (const qs of ['student_id=nope', 'limit=0', 'limit=201', 'offset=-1', 'limit=abc']) {
      const response = await enrolmentsRouter.request(`/?${qs}`)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a stable error without database text', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: { message: 'relation secret_table missing' } }))
    const response = await enrolmentsRouter.request('/')
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toEqual({ error: 'Enrolments are temporarily unavailable', code: 'ENROLMENTS_UNAVAILABLE' })
  })
})
