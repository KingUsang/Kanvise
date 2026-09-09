import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  user: { id: 'student-1', role: 'student' },
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => { await next() },
}))
vi.mock('../storage/r2', () => ({ createPresignedDownload: vi.fn() }))

import { guestMocksRouter } from './guest-mocks'

function fluent(result: unknown) {
  const builder: any = {
    select: vi.fn(() => builder), eq: vi.fn(() => builder), is: vi.fn(() => builder), gt: vi.fn(() => builder),
    insert: vi.fn(() => builder), single: vi.fn().mockResolvedValue(result), maybeSingle: vi.fn().mockResolvedValue(result),
  }
  return builder
}

describe('guest mock ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
  })

  it('keeps the opaque guest credential out of the response body', async () => {
    const insert = fluent({ data: { id: 'guest-1' }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guest_mock_learners') return insert
      throw new Error(`Unexpected table ${table}`)
    })
    mocks.rpc.mockResolvedValue({ data: { attempt_id: 'attempt-1', resumed: false }, error: null })

    const response = await guestMocksRouter.request('/guest/mock/offer-1/attempts', { method: 'POST' })
    const body = await response.json() as any
    const cookie = response.headers.get('set-cookie') || ''

    expect(response.status).toBe(201)
    expect(body).toEqual({ data: { attempt_id: 'attempt-1', resumed: false } })
    expect(JSON.stringify(body)).not.toContain('token')
    expect(cookie).toContain('kanvise_guest_mock=')
    expect(cookie.toLowerCase()).toContain('httponly')
    expect(cookie.toLowerCase()).toContain('secure')
    expect(cookie.toLowerCase()).toContain('samesite=lax')
  })

  it('returns an explicit collision without moving either attempt', async () => {
    const activeGuest = fluent({ data: { id: 'guest-1', claimed_at: null }, error: null })
    mocks.from.mockReturnValue(activeGuest)
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'STUDENT_ATTEMPT_IN_PROGRESS' } })

    const response = await guestMocksRouter.request('/guest/attempts/attempt-1/transfer', {
      method: 'POST',
      headers: { cookie: `kanvise_guest_mock=${'a'.repeat(43)}` },
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'This account already has this mock in progress. Finish that attempt before moving guest progress.',
      code: 'STUDENT_ATTEMPT_IN_PROGRESS',
    })
    expect(mocks.rpc).toHaveBeenCalledWith('transfer_guest_mock_attempt', expect.objectContaining({
      p_guest_id: 'guest-1', p_attempt_id: 'attempt-1', p_student_id: 'student-1',
    }))
  })
})
