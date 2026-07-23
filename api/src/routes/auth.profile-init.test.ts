import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  updateUserById: vi.fn(),
  getUserById: vi.fn(),
  ensureWelcomeEmail: vi.fn(),
  validateInviteToken: vi.fn(),
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
    c.set('user', { supabase_auth_id: 'auth-1' })
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

describe('POST /auth/profile/init role hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('FRONTEND_URL', 'https://kanvise.com')
  })

  it('rejects a role outside the allowlist', async () => {
    const response = await initProfile({ role: 'superadmin', first_name: 'Mal', last_name: 'Actor' })
    const body = await response.json() as any

    expect(response.status).toBe(400)
    expect(body.error).toBe('Invalid role')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing role', async () => {
    const response = await initProfile({ first_name: 'No', last_name: 'Role' })
    const body = await response.json() as any

    expect(response.status).toBe(400)
    expect(body.error).toBe('Invalid role')
  })

  it('rejects a new tutor without an invite token', async () => {
    // No existing profile, so the handler proceeds to the tutor invite check.
    mocks.from.mockReturnValue(profileLookup({ data: null, error: null }))

    const response = await initProfile({ role: 'tutor', first_name: 'Tu', last_name: 'Tor' })
    const body = await response.json() as any

    expect(response.status).toBe(400)
    expect(body.error).toBe('Invite token required for tutors')
  })
})
