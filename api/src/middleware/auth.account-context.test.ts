import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  membership: { data: { id: 'membership-1', school_id: 'account-1', role: 'learner', status: 'active' }, error: null } as any,
  account: { data: { id: 'account-1' }, error: null } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))

import { ACCOUNT_CONTEXT_HEADER, accountContextMiddleware } from './auth'

function query(result: any) {
  const value: any = {
    select: vi.fn(() => value),
    eq: vi.fn(() => value),
    maybeSingle: vi.fn(async () => result),
  }
  return value
}

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111'
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222'

function listQuery(result: any) {
  const value: any = {
    select: vi.fn(() => value),
    eq: vi.fn(() => value),
    limit: vi.fn(async () => result),
  }
  return value
}

function app(user: any = { id: 'person-1', role: 'admin' }) {
  const application = new Hono()
  application.use('/settings', async (c, next) => {
    c.set('user', user)
    return accountContextMiddleware(c, next)
  })
  application.get('/settings', c => c.json({ account: c.get('account') }))
  return application
}

describe('account request context', () => {
  it('resolves the only active membership of an admin when no header is sent', async () => {
    vi.clearAllMocks()
    const lookup = listQuery({ data: [{ school_id: ACCOUNT_A }], error: null })
    mocks.from
      .mockImplementationOnce(() => lookup)
      .mockImplementationOnce(() => query({ data: { id: 'membership-admin', school_id: ACCOUNT_A, role: 'admin', status: 'active' }, error: null }))
      .mockImplementationOnce(() => query({ data: { id: ACCOUNT_A }, error: null }))

    const response = await app().request('/settings')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      account: { id: ACCOUNT_A, membershipId: 'membership-admin', role: 'admin' },
    })
    // The lookup is for any role: no role filter, only the person and active status.
    expect(lookup.eq.mock.calls).toEqual([['person_id', 'person-1'], ['status', 'active']])
    expect(lookup.limit).toHaveBeenCalledWith(2)
  })

  it('asks a tutor with two active memberships and no header to choose an account', async () => {
    vi.clearAllMocks()
    mocks.from.mockImplementationOnce(() => listQuery({ data: [{ school_id: ACCOUNT_A }, { school_id: ACCOUNT_B }], error: null }))

    const response = await app({ id: 'person-1', role: 'tutor' }).request('/settings')

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_SELECTION_REQUIRED' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('keeps ACCOUNT_CONTEXT_REQUIRED when the person has no active membership', async () => {
    vi.clearAllMocks()
    mocks.from.mockImplementationOnce(() => listQuery({ data: [], error: null }))

    const response = await app().request('/settings')

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
  })

  it('returns 503 when the membership lookup fails', async () => {
    vi.clearAllMocks()
    mocks.from.mockImplementationOnce(() => listQuery({ data: null, error: { message: 'down' } }))

    const response = await app().request('/settings')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_CONTEXT_UNAVAILABLE' })
  })

  it('rejects a malformed header without querying memberships', async () => {
    vi.clearAllMocks()

    const response = await app().request('/settings', { headers: { [ACCOUNT_CONTEXT_HEADER]: 'not-a-uuid' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('denies a forged well-formed header for an account the person is not a member of', async () => {
    vi.clearAllMocks()
    // The person has exactly one membership (ACCOUNT_A); the header names ACCOUNT_B.
    const membershipLookup = query({ data: null, error: null })
    mocks.from.mockImplementation(() => membershipLookup)

    const response = await app().request('/settings', { headers: { [ACCOUNT_CONTEXT_HEADER]: ACCOUNT_B } })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_ACCESS_DENIED' })
    expect(membershipLookup.eq).toHaveBeenCalledWith('school_id', ACCOUNT_B)
    expect(membershipLookup.eq).toHaveBeenCalledWith('person_id', 'person-1')
  })

  it('resolves membership and active account without using profile school state', async () => {
    vi.clearAllMocks()
    mocks.from.mockImplementation((table: string) => table === 'account_memberships' ? query(mocks.membership) : query(mocks.account))

    const response = await app().request('/settings', {
      headers: { [ACCOUNT_CONTEXT_HEADER]: '11111111-1111-4111-8111-111111111111' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      account: { id: 'account-1', membershipId: 'membership-1', role: 'learner' },
    })
    expect(mocks.from).toHaveBeenNthCalledWith(1, 'account_memberships')
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'schools')
  })

  it('fails closed on revoked membership and does not inspect the account', async () => {
    vi.clearAllMocks()
    mocks.from.mockImplementation(() => query({ data: null, error: null }))

    const response = await app().request('/settings', {
      headers: { [ACCOUNT_CONTEXT_HEADER]: '11111111-1111-4111-8111-111111111111' },
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_ACCESS_DENIED' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('account_memberships')
  })

  it('keeps concurrent account requests independent', async () => {
    vi.clearAllMocks()
    const requests: string[] = []
    mocks.from.mockImplementation((table: string) => {
      if (table === 'account_memberships') {
        const builder = query({ data: { id: 'membership-' + (requests.length + 1), school_id: requests.at(-1), role: 'learner', status: 'active' }, error: null })
        const originalEq = builder.eq
        builder.eq = vi.fn((field: string, value: string) => {
          if (field === 'school_id') requests.push(value)
          return originalEq(field, value)
        })
        return builder
      }
      return query({ data: { id: requests.at(-1) }, error: null })
    })

    const first = await app().request('/settings', { headers: { [ACCOUNT_CONTEXT_HEADER]: '11111111-1111-4111-8111-111111111111' } })
    const second = await app().request('/settings', { headers: { [ACCOUNT_CONTEXT_HEADER]: '22222222-2222-4222-8222-222222222222' } })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    await expect(first.json()).resolves.toMatchObject({ account: { id: '11111111-1111-4111-8111-111111111111' } })
    await expect(second.json()).resolves.toMatchObject({ account: { id: '22222222-2222-4222-8222-222222222222' } })
  })
})
