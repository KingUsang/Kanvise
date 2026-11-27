import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
  insertedSlugs: [] as string[],
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    auth: { admin: { getUserById: mocks.getUserById, updateUserById: mocks.updateUserById } },
  },
}))

vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', { id: 'admin-1', supabase_auth_id: 'auth-1', school_id: null, role: 'admin' })
    await next()
  },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { const u = c.get('user'); c.set('account', { id: u.school_id, membershipId: 'membership-1', role: u.role === 'student' ? 'learner' : u.role }); await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => { await next() },
}))

vi.mock('../emails/send-tutor-invitation', () => ({ sendTutorInvitation: vi.fn() }))

import { schoolsRouter } from './schools'

const post = (body: unknown) => schoolsRouter.request('/', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

describe('POST /schools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertedSlugs.length = 0
    let attempt = 0
    mocks.rpc.mockImplementation(async (_name: string, args: any) => {
      mocks.insertedSlugs.push(args.p_slug)
      attempt += 1
      return attempt === 1
        ? { data: null, error: { code: '23505', message: 'duplicate slug' } }
        : { data: { already_configured: false, school: { id: 'school-1', name: 'Bright Future', slug: args.p_slug } }, error: null }
    })
    mocks.getUserById.mockResolvedValue({ data: { user: { app_metadata: { role: 'admin' } } }, error: null })
    mocks.updateUserById.mockResolvedValue({ error: null })
  })

  it('selects the next generated link when the centre-name slug is taken', async () => {
    const response = await post({ name: 'Bright Future' })
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(mocks.insertedSlugs).toEqual(['bright-future', 'bright-future-2'])
    expect(body.school.slug).toBe('bright-future-2')
    expect(mocks.rpc).toHaveBeenCalledWith('create_school_for_admin', expect.objectContaining({ p_admin_id: 'admin-1', p_account_type: 'centre', p_name: 'Bright Future' }))
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.updateUserById).toHaveBeenCalledWith('auth-1', {
      app_metadata: { role: 'admin', school_id: 'school-1' },
    })
  })

  it('rejects a customised link that belongs to the application', async () => {
    const response = await post({ name: 'My Centre', slug: 'dashboard' })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'RESERVED_SLUG' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('reports an already configured account decided under the database row lock', async () => {
    mocks.rpc.mockReset()
    mocks.rpc.mockResolvedValue({ data: { already_configured: true }, error: null })

    const response = await post({ name: 'Second Try' })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'SCHOOL_ALREADY_CONFIGURED' })
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('does not leak database details when account creation fails', async () => {
    mocks.rpc.mockReset()
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation schools secret' } })

    const response = await post({ name: 'Bright Future' })
    const body = await response.json() as any

    expect(response.status).toBe(503)
    expect(body.code).toBe('SCHOOL_CREATE_UNAVAILABLE')
    expect(JSON.stringify(body)).not.toContain('secret')
  })

  it.each([
    ['the Auth user lookup fails', () => mocks.getUserById.mockResolvedValue({ data: { user: null }, error: { message: 'down' } })],
    ['the Auth user is missing', () => mocks.getUserById.mockResolvedValue({ data: { user: null }, error: null })],
    ['the claim update fails', () => mocks.updateUserById.mockResolvedValue({ error: { message: 'down' } })],
  ])('asks for a fresh sign-in instead of reporting success when %s', async (_name, arrange) => {
    arrange()

    const response = await post({ name: 'Bright Future' })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'SESSION_UPDATE_REQUIRED' })
  })

  it.each([
    [{ name: 'x'.repeat(121) }, 'INVALID_NAME'],
    [{ name: 'Ok', description: 'd'.repeat(501) }, 'DESCRIPTION_TOO_LONG'],
    [{ name: 'Ok', contact_email: 'not-an-email' }, 'VALIDATION_ERROR'],
    [{ name: '   ' }, 'INVALID_NAME'],
  ])('validates the request body %j', async (body, code) => {
    const response = await post(body)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('accepts independent_tutor and labels the account', async () => {
    mocks.rpc.mockReset()
    mocks.rpc.mockResolvedValue({ data: { already_configured: false, school: { id: 'school-1', name: 'Ada', slug: 'ada', account_type: 'independent' } }, error: null })

    const response = await post({ name: 'Ada', account_type: 'independent_tutor' })
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('create_school_for_admin', expect.objectContaining({ p_account_type: 'independent' }))
    expect(body.school.account_type_label).toBe('independent_tutor')
  })

  it('labels a centre as a tutoring agency', async () => {
    mocks.rpc.mockReset()
    mocks.rpc.mockResolvedValue({ data: { already_configured: false, school: { id: 'school-1', name: 'C', slug: 'c', account_type: 'centre' } }, error: null })

    const body = await (await post({ name: 'C' })).json() as any

    expect(body.school.account_type_label).toBe('tutoring_agency')
  })
})
