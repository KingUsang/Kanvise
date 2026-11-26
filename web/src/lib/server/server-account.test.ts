import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT ${url}`) }),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'kanvise_account' && mocks.cookieValue !== undefined ? { name, value: mocks.cookieValue } : undefined),
  }),
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))

import { serverAccountContextHeaders, serverActiveAccountId, ServerApiError, withAccountPicker } from './server-account'
import { getMockPreflight, getStudentAttempt } from '@/lib/student-mocks'

const account = '11111111-1111-4111-8111-111111111111'

describe('server account context', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mocks.redirect.mockClear()
    mocks.cookieValue = undefined
  })

  it('returns the account header from a valid selection cookie', async () => {
    mocks.cookieValue = account

    await expect(serverActiveAccountId()).resolves.toBe(account)
    await expect(serverAccountContextHeaders()).resolves.toEqual({ 'X-Kanvise-Account-Id': account })
  })

  it('ignores a missing or invalid cookie value', async () => {
    await expect(serverAccountContextHeaders()).resolves.toEqual({})
    mocks.cookieValue = 'not-a-uuid'
    await expect(serverAccountContextHeaders()).resolves.toEqual({})
    mocks.cookieValue = `${account}; injected`
    await expect(serverAccountContextHeaders()).resolves.toEqual({})
  })

  it('sends X-Kanvise-Account-Id from the cookie on a server-side page fetch', async () => {
    mocks.cookieValue = account
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { id: 'mock-1' } }), { status: 200 }))

    const headers = await serverAccountContextHeaders()
    await getMockPreflight('mock-1', 'server-token', headers)
    await getStudentAttempt('attempt-1', 'server-token', headers).catch(() => undefined)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example.test/mocks/mock-1/preflight', expect.objectContaining({
      headers: { 'X-Kanvise-Account-Id': account, Authorization: 'Bearer server-token' },
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example.test/attempts/attempt-1', expect.objectContaining({
      headers: { 'X-Kanvise-Account-Id': account, Authorization: 'Bearer server-token' },
    }))
  })

  it('redirects to the account picker when the API asks for a selection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Choose', code: 'ACCOUNT_SELECTION_REQUIRED' }), { status: 409 }))

    await expect(withAccountPicker(() => getMockPreflight('mock-1', 'server-token'), '/dashboard/student/mocks/mock-1'))
      .rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/account/select?redirect=%2Fdashboard%2Fstudent%2Fmocks%2Fmock-1')
  })

  it('opens the account picker when the API rejects a stale account cookie', async () => {
    mocks.cookieValue = account
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Not a member', code: 'ACCOUNT_ACCESS_DENIED' }), { status: 403 }))

    await expect(withAccountPicker(() => getMockPreflight('mock-1', 'server-token', { 'X-Kanvise-Account-Id': account }), '/dashboard/student/mocks/mock-1'))
      .rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/account/select?redirect=%2Fdashboard%2Fstudent%2Fmocks%2Fmock-1')
  })

  it('rethrows ACCOUNT_ACCESS_DENIED when no account cookie was sent', async () => {
    const failure = new ServerApiError('Not a member', 403, 'ACCOUNT_ACCESS_DENIED')
    await expect(withAccountPicker(async () => { throw failure }, '/x')).rejects.toBe(failure)
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('rethrows other API errors unchanged', async () => {
    const failure = new ServerApiError('Not found', 404, 'NOT_FOUND')
    await expect(withAccountPicker(async () => { throw failure }, '/x')).rejects.toBe(failure)
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
