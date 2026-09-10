import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  updateUserById: vi.fn(),
  getUserById: vi.fn(),
  ensureWelcomeEmail: vi.fn(),
  validateInviteToken: vi.fn(),
  user: { supabase_auth_id: 'auth-1' } as any,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    auth: { admin: { updateUserById: mocks.updateUserById, getUserById: mocks.getUserById } },
  },
}))

vi.mock('../lib/invites', () => ({
  validateInviteToken: mocks.validateInviteToken,
}))

vi.mock('../emails/ensure-welcome-email', () => ({
  ensureWelcomeEmail: mocks.ensureWelcomeEmail,
}))

vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('jwt_payload', { email: 'new-user@example.com', app_metadata: {} })
    await next()
  },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', mocks.user)
    await next()
  },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => { await next() },
}))

import { authRouter } from './auth'

function profileLookup(result: unknown) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => result,
  }
  return builder
}

async function initProfile(body: Record<string, unknown>) {
  return authRouter.request('/profile/init', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /auth/profile/init registration flow hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { supabase_auth_id: 'auth-1' }
    vi.stubEnv('FRONTEND_URL', 'https://kanvise.com')
  })

  it('rejects a client-supplied role without a registration flow', async () => {
    const response = await initProfile({ role: 'superadmin', first_name: 'Mal', last_name: 'Actor' })
    const body = await response.json() as any

    expect(response.status).toBe(400)
    expect(body.error).toBe('A valid registration flow is required')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing registration flow', async () => {
    const response = await initProfile({ first_name: 'No', last_name: 'Role' })
    const body = await response.json() as any

    expect(response.status).toBe(400)
    expect(body.error).toBe('A valid registration flow is required')
  })

  it('rejects a new tutor without an invite token', async () => {
    // No existing profile, so the handler proceeds to the tutor invite check.
    mocks.from.mockReturnValue(profileLookup({ data: null, error: null }))

    const response = await initProfile({ flow: 'tutor', first_name: 'Tu', last_name: 'Tor' })
    const body = await response.json() as any

    expect(response.status).toBe(400)
    expect(body.error).toBe('Invite token required for tutors')
  })
})

describe('POST /auth/profile/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('FRONTEND_URL', 'https://kanvise.com')
    mocks.user = { id: 'student-1', supabase_auth_id: 'auth-1', role: 'student' }
  })

  it('activates the roster profile without sending a duplicate welcome email', async () => {
    const update = vi.fn(() => builder)
    const builder: any = {
      update,
      eq: vi.fn(() => builder),
      then: (resolve: (value: unknown) => unknown) => resolve({ error: null }),
    }
    mocks.from.mockReturnValue(builder)

    const response = await authRouter.request('/profile/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ first_name: ' Ada ', last_name: ' Okafor ' }),
    })

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'Ada', last_name: 'Okafor', onboarding_status: 'active' }))
    expect(mocks.ensureWelcomeEmail).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ message: 'Student profile activated' })
  })

  it('does not activate an unnamed student profile', async () => {
    const response = await authRouter.request('/profile/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ first_name: '', last_name: '' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
