import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(() => []),
  getClaims: vi.fn(),
  getSession: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: mocks.getAll }),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getClaims: mocks.getClaims,
      getSession: mocks.getSession,
    },
  }),
}))

import { requireServerAccessToken } from './server-session'

describe('requireServerAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies claims before returning the session bearer token', async () => {
    const order: string[] = []
    mocks.getClaims.mockImplementation(async () => {
      order.push('claims')
      return { data: { claims: { sub: 'auth-user-1' } }, error: null }
    })
    mocks.getSession.mockImplementation(async () => {
      order.push('session')
      return { data: { session: { access_token: 'verified-transport-token' } }, error: null }
    })

    await expect(requireServerAccessToken()).resolves.toBe('verified-transport-token')
    expect(order).toEqual(['claims', 'session'])
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('redirects without asking for a session when claims are absent', async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null })

    await expect(requireServerAccessToken()).rejects.toThrow('REDIRECT:/auth/login')
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it('redirects without asking for a session when claims verification fails', async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: new Error('claims unavailable') })

    await expect(requireServerAccessToken()).rejects.toThrow('REDIRECT:/auth/login')
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it('redirects after valid claims when no bearer token is available', async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: 'auth-user-1' } }, error: null })
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })

    await expect(requireServerAccessToken()).rejects.toThrow('REDIRECT:/auth/login')
    expect(mocks.getSession).toHaveBeenCalledOnce()
  })
})
