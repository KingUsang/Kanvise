import { beforeEach, describe, expect, it, vi } from 'vitest'

const SECRET = 'relation "secret_table" does not exist'
const mocks = vi.hoisted(() => ({ from: vi.fn(), user: { id: 'tutor-1', role: 'tutor', school_id: 'school-1' } as any }))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/r2', () => ({ createPresignedDownload: vi.fn() }))
vi.mock('../notifications/triggers', () => ({ notifyMockPublished: vi.fn() }))
vi.mock('../middleware/account-projection', () => ({ accountUserProjection: async (_c: any, next: () => Promise<void>) => next() }))
vi.mock('../middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../middleware/auth')>()),
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { c.set('account', { id: 'school-1', role: mocks.user.role }); await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: any, next: () => Promise<void>) => next(),
  requireMembershipRole: () => async (_c: any, next: () => Promise<void>) => next(),
}))

import { mocksRouter } from './mocks'
import { subProgrammesRouter } from './sub_programmes'
import { paymentsRouter } from './payments'

function result(value: any) {
  const b: any = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'then') return (resolve: (v: any) => void) => Promise.resolve(value).then(resolve)
      if (prop === 'single' || prop === 'maybeSingle') return async () => value
      return () => b
    },
  })
  return b
}

describe('generic 5xx bodies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('mocks list hides a tutor-assignment lookup failure', async () => {
    mocks.from.mockImplementation((table: string) => result(table === 'tutor_course_assignments'
      ? { data: null, error: { code: '42P01', message: SECRET } } : { data: [], error: null }))
    const res = await mocksRouter.request('/')
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secret_table')
  })

  it('sub-programme update hides database detail', async () => {
    mocks.from.mockImplementation(() => result({ data: null, error: { code: '42P01', message: SECRET } }))
    const res = await subProgrammesRouter.request('/sp-1', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'x' }),
    })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Something went wrong. Please try again.', code: 'DATABASE_ERROR' })
  })

  it('payments banks hides provider error detail', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1 secret'))
    const res = await paymentsRouter.request('/banks')
    fetchSpy.mockRestore()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to fetch banks', code: 'PAYMENT_PROVIDER_ERROR' })
  })
})
