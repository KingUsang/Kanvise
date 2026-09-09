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
})
