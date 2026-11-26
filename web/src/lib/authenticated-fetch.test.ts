import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accountScopedFetch, authenticatedFetch } from './authenticated-fetch'
import { clearActiveAccountId, setActiveAccountId } from './account-preference'

function pickerSupabase() {
  return { auth: { refreshSession: vi.fn() } } as unknown as Parameters<typeof authenticatedFetch>[0]
}

describe('authenticatedFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearActiveAccountId()
  })

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

  it('does not refresh for a 401 that is not an expired access token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'ACCOUNT_INACTIVE' }), { status: 401 }))
    const refreshSession = vi.fn()

    const response = await authenticatedFetch(
      { auth: { refreshSession } } as any,
      '/dashboard/student',
      'token',
    )

    expect(response.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('returns a clear sign-in message when the refresh session has ended', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'TOKEN_EXPIRED' }), { status: 401 }))
    const refreshSession = vi.fn().mockResolvedValue({ data: { session: null }, error: new Error('refresh expired') })

    const response = await authenticatedFetch(
      { auth: { refreshSession } } as any,
      '/dashboard/student',
      'expired-token',
    )

    expect(await response.json()).toEqual({ error: 'Your session has ended. Please sign in again.', code: 'SESSION_EXPIRED' })
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

  it('returns a parseable session-ended response when no current token exists', async () => {
    const getSession = vi.fn().mockResolvedValue({ data: { session: null } })
    const supabase = { auth: { getSession, onAuthStateChange: vi.fn(), refreshSession: vi.fn() } } as any

    const response = await authenticatedFetch(supabase, '/dashboard/student')

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: 'Your session has ended. Please sign in again.',
      code: 'SESSION_EXPIRED',
    })
  })

  it('replaces a caller-supplied Authorization header instead of sending two bearer tokens', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await authenticatedFetch(
      { auth: { refreshSession: vi.fn() } } as any,
      '/mocks/mock-1',
      'current-token',
      { headers: { authorization: 'Bearer stale-server-token', 'X-Request-ID': 'request-1' } },
    )

    expect(fetchMock).toHaveBeenCalledWith('/mocks/mock-1', expect.objectContaining({
      headers: { Authorization: 'Bearer current-token', 'x-request-id': 'request-1' },
    }))
  })

  it('attaches the active account preference to every authenticated request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const accountId = '22222222-2222-4222-8222-222222222222'
    setActiveAccountId(accountId)

    await authenticatedFetch({ auth: { refreshSession: vi.fn() } } as any, '/dashboard', 'current-token', {
      headers: { 'X-Kanvise-Account-Id': 'stale-account' },
    })

    expect(fetchMock).toHaveBeenCalledWith('/dashboard', expect.objectContaining({
      headers: { Authorization: 'Bearer current-token', 'X-Kanvise-Account-Id': accountId },
    }))
  })

  it('shares one refresh when requests receive 401 together', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'TOKEN_EXPIRED' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'TOKEN_EXPIRED' }), { status: 401 }))
      .mockResolvedValue(new Response(null, { status: 200 }))
    const refreshSession = vi.fn(() => new Promise(resolve => setTimeout(() => resolve({ data: { session: { access_token: 'fresh-token' } }, error: null }), 0)))
    const supabase = { auth: { refreshSession, getSession: vi.fn().mockResolvedValue({ data: { session: null } }), onAuthStateChange: vi.fn() } } as any

    const responses = await Promise.all([
      authenticatedFetch(supabase, '/one', 'expired-one'),
      authenticatedFetch(supabase, '/two', 'expired-two'),
    ])

    expect(responses.every(response => response.status === 200)).toBe(true)
    expect(refreshSession).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('opens the account picker, returning to the current page, on ACCOUNT_SELECTION_REQUIRED', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'ACCOUNT_SELECTION_REQUIRED' }), { status: 409 }))
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, pathname: '/dashboard/payments', search: '?tab=1', assign } as unknown as Location)

    const response = await authenticatedFetch(pickerSupabase(), '/payments', 'current-token')

    expect(response.status).toBe(409)
    expect(assign).toHaveBeenCalledWith('/account/select?redirect=%2Fdashboard%2Fpayments%3Ftab%3D1')
  })

  it('does not redirect for other 409 conflicts or when already on the picker', async () => {
    const assign = vi.fn()
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'PAYMENT_INITIALIZING' }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'ACCOUNT_SELECTION_REQUIRED' }), { status: 409 }))
    const location = vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, pathname: '/dashboard', search: '', assign } as unknown as Location)
    await authenticatedFetch(pickerSupabase(), '/one', 'current-token')
    location.mockReturnValue({ ...window.location, pathname: '/account/select', search: '', assign } as unknown as Location)
    await authenticatedFetch(pickerSupabase(), '/two', 'current-token')

    expect(assign).not.toHaveBeenCalled()
  })

  it('opens the account picker from raw-fetch callers that use accountScopedFetch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'ACCOUNT_SELECTION_REQUIRED' }), { status: 409 }))
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, pathname: '/class/class-1', search: '', assign } as unknown as Location)
    const init = { method: 'POST', headers: { Authorization: 'Bearer caller-token' } }

    const response = await accountScopedFetch('/live-classes/class-1/enter', init)

    expect(response.status).toBe(409)
    expect(fetchMock).toHaveBeenCalledWith('/live-classes/class-1/enter', init)
    expect(assign).toHaveBeenCalledWith('/account/select?redirect=%2Fclass%2Fclass-1')
  })

})
