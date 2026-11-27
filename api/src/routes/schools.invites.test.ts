import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  generateLink: vi.fn(),
  sendTutorInvitation: vi.fn(),
  createAccountInvitation: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc, auth: { admin: { generateLink: mocks.generateLink } } },
}))

vi.mock('../emails/send-tutor-invitation', () => ({
  sendTutorInvitation: mocks.sendTutorInvitation,
}))

vi.mock('../lib/account-invitations', () => ({
  createAccountInvitation: mocks.createAccountInvitation,
}))

vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('jwt_payload', { email: 'admin@example.com' })
    await next()
  },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', { id: 'admin-1', school_id: 'school-1', role: 'admin', first_name: 'Ada', last_name: 'Okafor' })
    await next()
  },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { const u = c.get('user'); c.set('account', { id: u.school_id, membershipId: 'membership-1', role: u.role === 'student' ? 'learner' : u.role }); await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => { await next() },
}))

import { schoolsRouter } from './schools'

function query(result: unknown, terminal: 'maybeSingle' | 'single') {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    [terminal]: async () => result,
  }
  return builder
}

function listBuilder(result: unknown) {
  const calls: Array<[string, unknown[]]> = []
  const builder: any = new Proxy({}, {
    get: (_t, prop: string) => {
      if (prop === 'then') return (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
      return (...args: unknown[]) => { calls.push([prop, args]); return builder }
    },
  })
  return { builder, calls }
}

const INVITE_ID = '44444444-4444-4444-8444-444444444444'

describe('POST /schools/me/invite/tutor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('FRONTEND_URL', 'https://kanvise.com')
    mocks.createAccountInvitation.mockResolvedValue({
      token: 'durable-token',
      expiresAt: '2026-07-27T12:00:00.000Z',
      invitation: { id: 'account-invite-1' },
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'schools') return query({ data: { name: 'Bright Minds' }, error: null }, 'single')
      throw new Error(`Unexpected table: ${table}`)
    })
  })

  const invite = (body: unknown) => schoolsRouter.request('/me/invite/tutor', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  it('creates one durable invitation and retains it when email delivery fails', async () => {
    mocks.sendTutorInvitation.mockRejectedValue(new Error('provider unavailable'))

    const response = await invite({ email: ' Tutor@Example.com ' })
    const body = await response.json() as any

    expect(response.status).toBe(201)
    expect(body.data.email_sent).toBe(false)
    expect(body.data.email_id).toBeNull()
    expect(body.data.invite_url).toBe('https://kanvise.com/invite?token=durable-token')
    expect(body.data.expires_at).toBe('2026-07-27T12:00:00.000Z')
    expect(mocks.createAccountInvitation).toHaveBeenCalledWith({ schoolId: 'school-1', invitedBy: 'admin-1', role: 'tutor', email: 'tutor@example.com' })
    expect(mocks.from).not.toHaveBeenCalledWith('tutor_invites')
    expect(mocks.sendTutorInvitation).toHaveBeenCalledOnce()
    expect(mocks.sendTutorInvitation.mock.calls[0][0].inviteUrl).toBe(body.data.invite_url)
    expect(mocks.generateLink).not.toHaveBeenCalled()
  })

  it.each([{}, { email: '' }, { email: 'not-an-email' }, { email: 'a'.repeat(250) + '@x.com' }, { email: 42 }])('rejects an invalid email %j before any write', async (payload) => {
    const response = await invite(payload)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'BAD_REQUEST' })
    expect(mocks.createAccountInvitation).not.toHaveBeenCalled()
  })

  it('returns a safe retryable error when the atomic create fails', async () => {
    mocks.createAccountInvitation.mockRejectedValue(new Error('duplicate key secret'))

    const response = await invite({ email: 'tutor@example.com' })
    const body = await response.json() as any

    expect(response.status).toBe(503)
    expect(body.code).toBe('INVITATION_UNAVAILABLE')
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(mocks.sendTutorInvitation).not.toHaveBeenCalled()
  })
})

describe('GET /schools/me/invites', () => {
  beforeEach(() => vi.clearAllMocks())

  it('bounds the page, orders deterministically and reports has_more', async () => {
    const rows = [1, 2, 3].map((n) => ({ id: `i${n}`, email: `t${n}@x.com`, status: 'pending', expires_at: '2999-01-01T00:00:00.000Z', accepted_at: null, created_at: '2026-01-01T00:00:00.000Z' }))
    const { builder, calls } = listBuilder({ data: rows, error: null })
    mocks.from.mockReturnValue(builder)

    const response = await schoolsRouter.request('/me/invites?limit=2&offset=2')
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.pagination).toEqual({ limit: 2, offset: 2, has_more: true })
    expect(calls).toContainEqual(['range', [2, 4]])
    expect(calls).toContainEqual(['eq', ['school_id', 'school-1']])
    expect(calls).toContainEqual(['order', ['id', { ascending: false }]])
  })

  it('reports a pending row past its expiry as expired', async () => {
    const { builder } = listBuilder({ data: [{ id: 'i1', email: 'a@x.com', status: 'pending', expires_at: '2000-01-01T00:00:00.000Z' }], error: null })
    mocks.from.mockReturnValue(builder)

    const body = await (await schoolsRouter.request('/me/invites')).json() as any

    expect(body.data[0].status).toBe('expired')
    expect(body.pagination).toEqual({ limit: 50, offset: 0, has_more: false })
  })

  it.each(['?status=bogus', '?limit=0', '?limit=101', '?offset=-1'])('rejects %s without querying', async (qs) => {
    const response = await schoolsRouter.request(`/me/invites${qs}`)

    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('maps a database failure to a safe retryable error', async () => {
    const { builder } = listBuilder({ data: null, error: { code: 'XX000', message: 'secret' } })
    mocks.from.mockReturnValue(builder)

    const response = await schoolsRouter.request('/me/invites')

    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('secret')
  })
})

describe('POST /schools/me/invites/:id/revoke', () => {
  beforeEach(() => vi.clearAllMocks())
  const revoke = (id: string) => schoolsRouter.request(`/me/invites/${id}/revoke`, { method: 'POST' })

  it('revokes through the atomic database workflow scoped to the account', async () => {
    mocks.rpc.mockResolvedValue({ data: { found: true, revoked: true, status: 'revoked' }, error: null })

    const response = await revoke(INVITE_ID)

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('revoke_tutor_invitation', { p_school_id: 'school-1', p_tutor_invite_id: INVITE_ID })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 only when the lookup succeeded and found no row', async () => {
    mocks.rpc.mockResolvedValue({ data: { found: false }, error: null })
    expect((await revoke(INVITE_ID)).status).toBe(404)
    expect((await revoke('not-a-uuid')).status).toBe(404)
  })

  it('returns a retryable 503 on a dependency failure instead of a false 404', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '57P01', message: 'secret' } })

    const response = await revoke(INVITE_ID)
    const body = await response.json() as any

    expect(response.status).toBe(503)
    expect(body.code).toBe('INVITE_REVOKE_UNAVAILABLE')
    expect(JSON.stringify(body)).not.toContain('secret')
  })

  it('refuses to revoke an invitation that was already accepted', async () => {
    mocks.rpc.mockResolvedValue({ data: { found: true, revoked: false, status: 'accepted' }, error: null })

    const response = await revoke(INVITE_ID)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_STATUS' })
  })
})
