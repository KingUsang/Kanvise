import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  updateUserById: vi.fn(),
  generateLink: vi.fn(),
  findAccountInvitation: vi.fn(),
  ensureWelcomeEmail: vi.fn(),
  user: { id: 'profile-1', supabase_auth_id: 'auth-1', role: 'student', email: 'new-user@example.com' } as any,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    auth: { admin: { updateUserById: mocks.updateUserById, generateLink: mocks.generateLink } },
  },
}))
vi.mock('../emails/ensure-welcome-email', () => ({ ensureWelcomeEmail: mocks.ensureWelcomeEmail }))
vi.mock('../lib/account-invitations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/account-invitations')>()),
  findAccountInvitation: mocks.findAccountInvitation,
}))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('jwt_payload', { email: 'new-user@example.com', app_metadata: {} })
    await next()
  },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
}))

import { createHash } from 'node:crypto'
import { authRouter } from './auth'

const token = 'a'.repeat(43)
const tokenHash = createHash('sha256').update(token).digest('hex')

function post(path: string, body: unknown) {
  return authRouter.request(path, {
    method: 'POST',
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

const pendingInvitation = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-1', role: 'tutor', email: 'new-user@example.com', school_id: 'school-1', status: 'pending',
  expires_at: '2999-01-01T00:00:00.000Z', supabase_auth_id: null, student_profile_id: null, ...overrides,
})

describe('atomic registration (DEV-AUTH-001, DEV-AUTH-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubEnv('FRONTEND_URL', 'https://kanvise.com')
    mocks.user = { supabase_auth_id: 'auth-1' }
    mocks.updateUserById.mockResolvedValue({ data: {}, error: null })
    mocks.ensureWelcomeEmail.mockResolvedValue({ sent: true, id: 'mail-1', alreadySent: false })
  })

  const tutorBody = { flow: 'tutor', first_name: 'Tu', last_name: 'Tor', account_invitation_token: token }

  it('creates a tutor profile and consumes the invitation in one database call', async () => {
    mocks.findAccountInvitation.mockResolvedValue(pendingInvitation())
    mocks.from.mockReturnValue(chain({ data: null, error: null }))
    mocks.rpc.mockResolvedValue({ data: { status: 'created', profile: { id: 'p1', role: 'tutor', school_id: 'school-1', kanvise_user_id: 'KNV-TUT-00001' } }, error: null })

    const response = await post('/profile/init', tutorBody)

    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('register_user_profile', expect.objectContaining({
      p_role: 'tutor', p_supabase_auth_id: 'auth-1', p_invitation_token_hash: tokenHash, p_intent_token_hash: null,
    }))
    expect(mocks.updateUserById).toHaveBeenCalledWith('auth-1', expect.objectContaining({
      app_metadata: expect.objectContaining({ school_id: 'school-1', role: 'tutor' }),
    }))
  })

  it('reports a rejected invitation without writing Auth metadata or echoing the database message', async () => {
    mocks.findAccountInvitation.mockResolvedValue(pendingInvitation())
    mocks.from.mockReturnValue(chain({ data: null, error: null }))
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'INVITATION_AUTH_USER_MISMATCH', code: 'P0001' } })

    const response = await post('/profile/init', tutorBody)
    const body = await response.json() as any

    expect(response.status).toBe(409)
    expect(body.code).toBe('INVITATION_AUTH_USER_MISMATCH')
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('maps an unrecognised database failure to a retryable 503 without leaking it', async () => {
    mocks.findAccountInvitation.mockResolvedValue(pendingInvitation())
    mocks.from.mockReturnValue(chain({ data: null, error: null }))
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'deadlock detected secret', code: '40P01' } })

    const response = await post('/profile/init', tutorBody)
    const body = await response.json() as any

    expect(response.status).toBe(503)
    expect(body.retryable).toBe(true)
    expect(JSON.stringify(body)).not.toContain('secret')
  })

  it('returns 410 when the invitation expired during registration', async () => {
    mocks.findAccountInvitation.mockResolvedValue(pendingInvitation())
    mocks.from.mockReturnValue(chain({ data: null, error: null }))
    mocks.rpc.mockResolvedValue({ data: { status: 'expired' }, error: null })

    const response = await post('/profile/init', tutorBody)

    expect(response.status).toBe(410)
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('passes the student registration intent to the same transaction instead of consuming it first', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'registration_intents') return chain({ data: { id: 'intent-1', token_hash: tokenHash }, error: null })
      return chain({ data: null, error: null })
    })
    mocks.rpc.mockResolvedValue({ data: { status: 'created', profile: { id: 'p2', role: 'student', school_id: null, kanvise_user_id: 'KNV-STU-00001' } }, error: null })

    const response = await post('/profile/init', { flow: 'student', first_name: 'St', last_name: 'Udent', student_registration_token: token })

    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith('register_user_profile', expect.objectContaining({ p_role: 'student', p_intent_token_hash: tokenHash, p_invitation_token_hash: null }))
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(['register_user_profile'])
  })

  it('does not burn the registration link when the transaction fails', async () => {
    mocks.from.mockImplementation((table: string) => table === 'registration_intents'
      ? chain({ data: { id: 'intent-1', token_hash: tokenHash }, error: null })
      : chain({ data: null, error: null }))
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'ID_ALLOCATION_UNAVAILABLE', code: 'P0001' } })

    const response = await post('/profile/init', { flow: 'student', first_name: 'St', last_name: 'Udent', student_registration_token: token })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'REGISTRATION_UNAVAILABLE', retryable: true })
    // Only the registration function is called; nothing updated registration_intents separately.
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(['register_user_profile'])
  })

  it('reports an already consumed or expired intent as a conflict', async () => {
    mocks.from.mockImplementation((table: string) => table === 'registration_intents'
      ? chain({ data: { id: 'intent-1', token_hash: tokenHash }, error: null })
      : chain({ data: null, error: null }))
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'REGISTRATION_INTENT_INVALID', code: 'P0001' } })

    const response = await post('/profile/init', { flow: 'student', first_name: 'St', last_name: 'Udent', student_registration_token: token })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'REGISTRATION_INTENT_INVALID' })
  })

  it('treats a unique-violation race as a replay of the existing profile', async () => {
    mocks.findAccountInvitation.mockResolvedValue(pendingInvitation())
    const existing = { id: 'p1', role: 'tutor', school_id: 'school-1' }
    let profileReads = 0
    mocks.from.mockImplementation(() => chain({ data: profileReads++ === 0 ? null : existing, error: null }))
    mocks.rpc.mockImplementation(async (name: string) => name === 'register_user_profile'
      ? { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "user_profiles_supabase_auth_id_key"' } }
      : { data: { status: 'accepted' }, error: null })

    const response = await post('/profile/init', tutorBody)
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ created: false, profile: existing })
  })

  it('activates a roster Learner and consumes the invitation in one database call', async () => {
    mocks.findAccountInvitation.mockResolvedValue(pendingInvitation({ role: 'student', student_profile_id: 'roster-1' }))
    mocks.from.mockReturnValue(chain({ data: null, error: null }))
    const rosterProfile = { id: 'roster-1', school_id: 'school-1', kanvise_user_id: 'KNV-STU-00009', role: 'student' }
    mocks.rpc.mockResolvedValue({ data: { status: 'accepted', profile: rosterProfile }, error: null })

    const response = await post('/profile/init', { flow: 'student', first_name: 'Ro', last_name: 'Ster', account_invitation_token: token })

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('complete_student_invitation', {
      p_token_hash: tokenHash, p_email: 'new-user@example.com', p_supabase_auth_id: 'auth-1', p_first_name: 'Ro', p_last_name: 'Ster',
    })
    expect(await response.json()).toMatchObject({ created: false, profile: rosterProfile })
  })

  it('leaves the roster profile untouched when the invitation is rejected', async () => {
    mocks.findAccountInvitation.mockResolvedValue(pendingInvitation({ role: 'student', student_profile_id: 'roster-1' }))
    mocks.from.mockReturnValue(chain({ data: null, error: null }))
    mocks.rpc.mockResolvedValue({ data: { status: 'expired' }, error: null })

    const response = await post('/profile/init', { flow: 'student', first_name: 'Ro', last_name: 'Ster', account_invitation_token: token })

    expect(response.status).toBe(410)
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })
})

describe('POST /auth/profile/activate with an invitation (DEV-AUTH-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.user = { id: 'student-1', supabase_auth_id: 'auth-1', role: 'student', email: 'new-user@example.com', school_id: 'school-1', kanvise_user_id: 'KNV-STU-1' }
    mocks.updateUserById.mockResolvedValue({ data: {}, error: null })
  })
  const activate = (extra: Record<string, unknown> = {}) => post('/profile/activate', { first_name: ' Ada ', last_name: 'Okafor', account_invitation_token: token, ...extra })

  it('consumes the invitation and activates the profile together, never separately', async () => {
    mocks.findAccountInvitation.mockResolvedValue(pendingInvitation({ role: 'student', student_profile_id: 'student-1' }))
    mocks.rpc.mockResolvedValue({ data: { status: 'accepted', profile: {} }, error: null })

    const response = await activate()

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('complete_student_invitation', {
      p_token_hash: tokenHash, p_email: 'new-user@example.com', p_supabase_auth_id: 'auth-1', p_first_name: 'Ada', p_last_name: 'Okafor',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each([
    [{ data: { status: 'expired' }, error: null }, 410, 'INVITATION_EXPIRED'],
    [{ data: null, error: { message: 'INVITATION_NOT_PENDING', code: 'P0001' } }, 409, 'INVITATION_NOT_PENDING'],
    [{ data: null, error: { message: 'connection reset secret', code: '08006' } }, 503, 'INVITATION_UNAVAILABLE'],
  ])('maps rejection %j to %i without activating the profile', async (rpcResult, status, code) => {
    mocks.findAccountInvitation.mockResolvedValue(pendingInvitation({ role: 'student', student_profile_id: 'student-1' }))
    mocks.rpc.mockResolvedValue(rpcResult)

    const response = await activate()
    const body = await response.json() as any

    expect(response.status).toBe(status)
    expect(body.code).toBe(code)
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('rejects an invitation that belongs to a different profile before any write', async () => {
    mocks.findAccountInvitation.mockResolvedValue(pendingInvitation({ role: 'student', student_profile_id: 'someone-else' }))

    const response = await activate()

    expect(response.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('reports an invitation lookup outage as retryable instead of invalid', async () => {
    mocks.findAccountInvitation.mockRejectedValue(new Error('db down'))

    const response = await activate()

    expect(response.status).toBe(503)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('POST /auth/invitation/start (DEV-AUTH-006)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubEnv('FRONTEND_URL', 'https://kanvise.com')
    mocks.findAccountInvitation.mockResolvedValue(pendingInvitation({ id: 'inv-start', role: 'student', student_profile_id: 'student-1', metadata: {} }))
  })
  const link = { data: { properties: { action_link: 'https://project.supabase.co/auth/v1/verify?token=x' }, user: { id: 'auth-new' } }, error: null }
  // Each test uses a distinct token so the in-memory attempt limiter does not interfere.
  const start = (n: string) => post('/invitation/start', { token: n.repeat(43) })

  it('records the provider result for the invitation and roster profile in one call', async () => {
    mocks.generateLink.mockResolvedValue(link)
    mocks.rpc.mockResolvedValue({ data: { recorded: true }, error: null })

    const response = await start('b')

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('record_invitation_start', { p_invitation_id: 'inv-start', p_supabase_auth_id: 'auth-new' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not hand out the link when the start could not be recorded', async () => {
    mocks.generateLink.mockResolvedValue(link)
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'secret' } })

    const response = await start('c')
    const body = await response.json() as any

    expect(response.status).toBe(503)
    expect(body.code).toBe('INVITATION_START_FAILED')
    expect(body.data).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('secret')
  })

  it('retries as a magic link when the first attempt already created the provider user', async () => {
    mocks.generateLink
      .mockResolvedValueOnce({ data: null, error: { message: 'A user with this email address has already been registered' } })
      .mockResolvedValueOnce(link)
    mocks.rpc.mockResolvedValue({ data: { recorded: true }, error: null })

    const response = await start('d')

    expect(response.status).toBe(200)
    expect(mocks.generateLink.mock.calls.map(([args]) => args.type)).toEqual(['invite', 'magiclink'])
  })

  it('returns a stable error when the provider keeps failing', async () => {
    mocks.generateLink.mockResolvedValue({ data: null, error: { message: 'provider secret' } })

    const response = await start('e')
    const body = await response.json() as any

    expect(response.status).toBe(502)
    expect(body.code).toBe('INVITATION_START_FAILED')
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
