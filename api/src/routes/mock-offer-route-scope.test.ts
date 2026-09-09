import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))
vi.mock('../middleware/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('../middleware/auth')>()
  return {
    ...actual,
    jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
    profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
      c.set('user', { id: 'student-1', role: 'student', school_id: 'school-1' })
      await next()
    },
    tenantMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
  }
})

import { mockOfferAdminRouter } from './mock-access'

describe('mock offer admin route scope', () => {
  it('does not intercept a student attempt route mounted at the same prefix', async () => {
    const app = new Hono()
    app.route('/mocks', mockOfferAdminRouter)
    app.post('/mocks/:mockId/attempts', c => c.json({ started: true }, 201))

    const response = await app.request('/mocks/mock-1/attempts', { method: 'POST' })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ started: true })
  })

  it('still protects the actual offer-management endpoint', async () => {
    const app = new Hono()
    app.route('/mocks', mockOfferAdminRouter)

    const response = await app.request('/mocks/mock-1/offers')

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'INSUFFICIENT_ROLE' })
  })
})
