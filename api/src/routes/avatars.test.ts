import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'person-1', school_id: 'legacy-account', role: 'admin' } as any,
  account: { id: 'account-1', membershipId: 'membership-1', role: 'admin' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    if (!mocks.account) return c.json({ error: 'A valid tutoring account must be selected', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
    c.set('account', mocks.account)
    await next()
  },
}))

import { avatarsRouter } from './avatars'

function query(result: any) {
  const builder: any = {
    select: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(async () => result),
  }
  return builder
}

describe('avatar account policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'person-1', school_id: 'legacy-account', role: 'admin' }
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'admin' }
  })

  it('requires a selected active account before avatar access', async () => {
    mocks.account = null

    const response = await avatarsRouter.request('/me')

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('keeps avatar ownership on the verified person while projecting the selected account', async () => {
    const avatarQuery = query({ data: { id: 'avatar-1' }, error: null })
    mocks.from.mockReturnValue(avatarQuery)

    const response = await avatarsRouter.request('/me')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ avatar: { id: 'avatar-1' } })
    expect(avatarQuery.eq).toHaveBeenCalledWith('user_id', 'person-1')
  })

  it('maps avatar provider failures to a safe stable response', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: { code: 'XX', message: 'secret provider detail' } }))

    const response = await avatarsRouter.request('/me')

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Could not load avatar configuration', code: 'AVATAR_LOAD_FAILED' })
  })

  it('writes the own-person avatar with the selected account projection', async () => {
    const avatarQuery = query({ data: { id: 'avatar-1', school_id: 'account-1' }, error: null })
    mocks.from.mockReturnValue(avatarQuery)

    const response = await avatarsRouter.request('/me', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ style: 'friendly', school_id: 'forged-account' }),
    })

    expect(response.status).toBe(200)
    expect(avatarQuery.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'person-1',
      school_id: 'account-1',
    }), { onConflict: 'user_id' })
  })
})
