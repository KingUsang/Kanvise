import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  updateUserById: vi.fn(),
  generateLink: vi.fn(),
  findAccountInvitation: vi.fn(),
  validateInviteToken: vi.fn(),
  user: { id: 'profile-1', supabase_auth_id: 'auth-1', role: 'student' } as any,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    auth: { admin: { updateUserById: mocks.updateUserById, generateLink: mocks.generateLink } },
  },
}))
vi.mock('../lib/invites', () => ({ validateInviteToken: mocks.validateInviteToken }))
vi.mock('../emails/ensure-welcome-email', () => ({ ensureWelcomeEmail: vi.fn() }))
vi.mock('../lib/account-invitations', () => ({
  findAccountInvitation: mocks.findAccountInvitation,
  consumeAccountInvitation: vi.fn(),
  invitationTokenHash: (t: string) => `hash-${t}`,
  accountInvitationStatus: (i: any) => i.status,
}))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('jwt_payload', { email: 'new-user@example.com', app_metadata: {} })
    await next()
  },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
}))

import { authRouter } from './auth'

const token = 'a'.repeat(43)

function post(path: string, body: unknown, method = 'POST') {
  return authRouter.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function chain(result: unknown) {
  const b: any = new Proxy({}, {
    get: (_t, prop) => prop === 'then'
      ? (resolve: (v: unknown) => unknown) => resolve(result)
      : prop === 'maybeSingle' || prop === 'single' ? async () => result : () => b,
  })
  return b
}

describe('auth route hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubEnv('FRONTEND_URL', 'https://kanvise.com')
    mocks.user = { id: 'profile-1', supabase_auth_id: 'auth-1', role: 'student' }
    mocks.updateUserById.mockResolvedValue({ data: {}, error: null })
  })

  describe('profile schema (DEV-AUTH-011)', () => {
    it.each([
      ['oversized first name', { flow: 'centre', first_name: 'x'.repeat(101), last_name: 'Ok' }],
      ['non-string last name', { flow: 'centre', first_name: 'Ok', last_name: { a: 1 } }],
      ['oversized token', { flow: 'student', first_name: 'A', last_name: 'B', student_registration_token: 't'.repeat(257) }],
    ])('profile/init rejects %s before any lookup', async (_l, body) => {
      const response = await post('/profile/init', body)
      expect(response.status).toBe(400)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it.each([
      ['unknown field', { first_name: 'A', role: 'admin' }],
      ['oversized bio', { bio: 'b'.repeat(2001) }],
      ['empty name', { first_name: '   ' }],
      ['non-string name', { last_name: 5 }],
    ])('PATCH /me rejects %s', async (_l, body) => {
      const response = await post('/me', body, 'PATCH')
      expect(response.status).toBe(400)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('PATCH /me still saves the three editable fields', async () => {
      mocks.from.mockReturnValue(chain({ data: { first_name: 'Ada', last_name: 'O', bio: 'hi' }, error: null }))
      const response = await post('/me', { first_name: ' Ada ', last_name: 'O', bio: 'hi' }, 'PATCH')
      expect(response.status).toBe(200)
    })
  })

  describe('auth metadata results (DEV-AUTH-005)', () => {
    it('PATCH /me logs a failed metadata update and still returns the profile', async () => {
      mocks.from.mockReturnValue(chain({ data: { first_name: 'Ada', last_name: 'O' }, error: null }))
      mocks.updateUserById.mockResolvedValue({ data: null, error: { message: 'auth down', status: 500 } })
      const response = await post('/me', { first_name: 'Ada' }, 'PATCH')
      expect(response.status).toBe(200)
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('auth/me'), expect.objectContaining({ message: 'auth down' }))
    })

    it('profile/activate logs a thrown metadata update and still succeeds', async () => {
      mocks.from.mockReturnValue(chain({ error: null }))
      mocks.updateUserById.mockRejectedValue(new Error('network'))
      const response = await post('/profile/activate', { first_name: 'Ada', last_name: 'O' })
      expect(response.status).toBe(200)
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('auth/profile/activate'), expect.objectContaining({ message: 'network' }))
    })
  })

  describe('registration intent errors (DEV-AUTH-023)', () => {
    const body = { flow: 'student', first_name: 'A', last_name: 'B', student_registration_token: 'tok' }

    it('reports a lookup failure as retryable unavailable, not expired', async () => {
      mocks.from.mockReturnValue(chain({ data: null, error: { code: 'XX000', message: 'db down' } }))
      const response = await post('/profile/init', body)
      const json = await response.json() as any
      expect(response.status).toBe(503)
      expect(json.retryable).toBe(true)
      expect(JSON.stringify(json)).not.toMatch(/expired/i)
    })

    it('still reports a missing intent as expired', async () => {
      mocks.from.mockReturnValue(chain({ data: null, error: null }))
      const response = await post('/profile/init', body)
      expect(response.status).toBe(400)
      expect(((await response.json()) as any).error).toMatch(/expired/)
    })
  })

  describe('invitation lookup errors (DEV-AUTH-014)', () => {
    it.each(['/invitation/preview', '/invitation/start'])('%s returns retryable 503 when the lookup fails', async (path) => {
      mocks.findAccountInvitation.mockRejectedValue(new Error('db down'))
      const response = await post(path, { token })
      const json = await response.json() as any
      expect(response.status).toBe(503)
      expect(json).toMatchObject({ code: 'INVITATION_LOOKUP_UNAVAILABLE', retryable: true })
    })

    it.each(['/invitation/preview', '/invitation/start'])('%s keeps 404 for an unknown link', async (path) => {
      mocks.findAccountInvitation.mockResolvedValue(null)
      const response = await post(path, { token })
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'INVITATION_INVALID' })
    })

    it('tutor-invite preview returns 503 on a database error', async () => {
      mocks.validateInviteToken.mockReturnValue({ invite_id: 'i', school_id: 's', email: 'a@b.c' })
      mocks.from.mockReturnValue(chain({ data: null, error: { code: 'XX000' } }))
      const response = await post('/tutor-invite/preview', { invite_token: 'x' })
      expect(response.status).toBe(503)
    })
  })

  describe('generateLink failures (DEV-AUTH-017)', () => {
    it('returns a stable code and keeps provider detail in the log', async () => {
      mocks.findAccountInvitation.mockResolvedValue({
        id: 'inv-1', status: 'pending', role: 'student', email: 'a@b.c', school_id: 's',
        expires_at: new Date(Date.now() + 60_000).toISOString(), metadata: {},
      })
      mocks.generateLink.mockResolvedValue({ data: null, error: { message: 'smtp relay 10.0.0.5 rejected', status: 500 } })
      const response = await post('/invitation/start', { token: 'b'.repeat(43) })
      const text = JSON.stringify(await response.json())
      expect(response.status).toBe(502)
      expect(text).toContain('INVITATION_START_FAILED')
      expect(text).not.toContain('smtp')
      expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: 'smtp relay 10.0.0.5 rejected' }))
    })
  })
})
