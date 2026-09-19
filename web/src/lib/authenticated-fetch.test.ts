import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticatedFetch } from './authenticated-fetch'

describe('authenticatedFetch', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('refreshes once and retries the same request after an expired access token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'TOKEN_EXPIRED' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'ok' }), { status: 200 }))
    const refreshSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'fresh-token' } },
      error: null,
    })

    const response = await authenticatedFetch(
      { auth: { refreshSession } } as any,
      'https://api.example.test/mock/offer/attempts',
      'expired-token',
      { method: 'POST', headers: { 'Idempotency-Key': 'same-key' } },
    )

    expect(response.status).toBe(200)
    expect(refreshSession).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/mock/offer/attempts', expect.objectContaining({
      headers: { Authorization: 'Bearer expired-token', 'idempotency-key': 'same-key' },
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/mock/offer/attempts', expect.objectContaining({
      headers: { Authorization: 'Bearer fresh-token', 'idempotency-key': 'same-key' },
    }))
  })

  it('does not retry a non-authentication failure', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 409 }))
    const refreshSession = vi.fn()

    await authenticatedFetch({ auth: { refreshSession } } as any, '/mock/offer/attempts', 'token')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('supports using the client-managed session without a token argument', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'current-token' } } })
    const refreshSession = vi.fn()
    const supabase = { auth: { getSession, onAuthStateChange: vi.fn(), refreshSession } } as any

    const response = await authenticatedFetch(supabase, '/dashboard/student', { cache: 'no-store' })

    expect(response.status).toBe(204)
    expect(getSession).toHaveBeenCalledOnce()
    expect(refreshSession).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith('/dashboard/student', expect.objectContaining({
      headers: { Authorization: 'Bearer current-token' },
    }))
  })

  it('shares one refresh when requests receive 401 together', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValue(new Response(null, { status: 200 }))
    const refreshSession = vi.fn(() => new Promise(resolve => setTimeout(() => resolve({ data: { session: { access_token: 'fresh-token' } }, error: null }), 0)))
    const supabase = { auth: { refreshSession, getSession: vi.fn().mockResolvedValue({ data: { session: null } }), onAuthStateChange: vi.fn() } } as any

    const responses = await Promise.all([
      authenticatedFetch(supabase, '/one', 'expired-one'),
      authenticatedFetch(supabase, '/two', 'expired-two'),
    ])

    expect(responses.every(response => response.status === 200)).toBe(true)
    expect(refreshSession).toHaveBeenCalledOnce()
  })
})
