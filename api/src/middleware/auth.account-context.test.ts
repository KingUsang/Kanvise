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

function app() {
  const application = new Hono()
  application.use('/settings', async (c, next) => {
    c.set('user', { id: 'person-1' })
    return accountContextMiddleware(c, next)
  })
  application.get('/settings', c => c.json({ account: c.get('account') }))
  return application
}

describe('account request context', () => {
  it('requires an explicit account header', async () => {
    const response = await app().request('/settings')

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
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
