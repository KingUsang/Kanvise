import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOAuthContext, OAUTH_CONTEXT_COOKIE } from '@/lib/auth/oauth-context'

const mocks = vi.hoisted(() => ({
  cookie: '',
  exchangeCodeForSession: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => name === 'kanvise_oauth_context' && mocks.cookie ? { value: mocks.cookie } : undefined }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchangeCodeForSession } }),
}))

vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.kanvise.test' }))

import { GET } from './route'

describe('Google OAuth callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AUTH_CONTEXT_SECRET = 'a-secure-test-secret-that-is-long-enough'
    mocks.cookie = createOAuthContext({ intent: 'login' })
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: 'oauth-session-token' }, user: { id: 'existing-auth-user' } },
      error: null,
    })
  })

  it('opens the existing Kanvise account after same-email Google sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: {
      role: 'student', school_id: 'school-1', supabase_auth_id: 'existing-auth-user',
    } }), { status: 200, headers: { 'content-type': 'application/json' } })))

    const response = await GET(new Request('https://kanvise.test/api/auth/callback?code=google-oauth-code'))

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('google-oauth-code')
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/me$/), expect.objectContaining({
      headers: { Authorization: 'Bearer oauth-session-token' },
      cache: 'no-store',
    }))
    expect(response.headers.get('location')).toBe('https://kanvise.test/dashboard/student')
  })
})
