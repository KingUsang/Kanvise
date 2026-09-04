import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: { id: 'student-1', school_id: 'school-1', role: 'student' },
  upsertSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
}))

vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
}))
vi.mock('../push/config', () => ({ getPushConfig: () => ({ enabled: true, publicKey: 'vapid-public' }) }))
vi.mock('../push/repository', () => ({ pushRepository: mocks }))

import { pushRouter } from './push'

const subscription = { endpoint: 'https://push.test/device', expirationTime: null, keys: { p256dh: 'public-key', auth: 'auth-key' } }

describe('push subscription routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.upsertSubscription.mockResolvedValue({ id: 'sub-1' })
    mocks.deleteSubscription.mockResolvedValue(undefined)
  })

  it('returns the public VAPID configuration to an authenticated user', async () => {
    const response = await pushRouter.request('/config')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { enabled: true, publicKey: 'vapid-public' } })
  })

  it('derives subscription ownership and tenant from the authenticated profile', async () => {
    const response = await pushRouter.request('/subscriptions', {
      method: 'PUT', headers: { 'content-type': 'application/json', 'user-agent': 'Test Browser' },
      body: JSON.stringify({ ...subscription, userId: 'attacker', schoolId: 'other-school' }),
    })
    expect(response.status).toBe(200)
    expect(mocks.upsertSubscription).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1', schoolId: 'school-1', endpoint: subscription.endpoint, userAgent: 'Test Browser',
    }))
  })

  it('rejects malformed and insecure endpoints', async () => {
    const response = await pushRouter.request('/subscriptions', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...subscription, endpoint: 'http://push.test/device' }),
    })
    expect(response.status).toBe(400)
    expect(mocks.upsertSubscription).not.toHaveBeenCalled()
  })

  it('deletes only through the authenticated user identity', async () => {
    const response = await pushRouter.request('/subscriptions', {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint, userId: 'attacker' }),
    })
    expect(response.status).toBe(204)
    expect(mocks.deleteSubscription).toHaveBeenCalledWith('student-1', subscription.endpoint)
  })
})
