import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  updateUserById: vi.fn(),
  user: { id: 'admin-1', school_id: 'school-1', role: 'admin' } as any,
  account: { id: 'school-1', role: 'admin' } as any,
}))

function query(result: any) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    update: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: any) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

function configureImportQueries(profile: any, existingEnrolment: any = null) {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'programmes') return query({ data: [{ id: 'programme-1', name: 'Mathematics' }], error: null })
    if (table === 'schools') return query({ data: { name: 'Test Centre' }, error: null })
    if (table === 'user_profiles') return query({ data: profile ? [profile] : [], error: null })
    if (table === 'enrolments') return query({ data: existingEnrolment, error: null })
    throw new Error(`Unexpected table: ${table}`)
  })
}

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc, auth: { admin: { updateUserById: mocks.updateUserById } } } }))
vi.mock('../storage/r2', () => ({ publicFileUrl: (key: string) => `https://media.test/${key}` }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { c.set('account', mocks.account); await next() },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('account')?.role)) return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403)
    await next()
  },
}))

import { usersRouter } from './users'

describe('student import access and validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
    mocks.account = { id: 'school-1', role: 'admin' }
  })

  it('rejects non-admins before accessing student data', async () => {
    mocks.account.role = 'tutor'
    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ students: [{ first_name: 'Ada', last_name: 'Okafor', email: 'ada@example.test', programme_id: 'programme-1' }] }),
    })

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a programme and an email before querying the database', async () => {
    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ students: [{ first_name: 'Ada', last_name: 'Okafor' }] }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('allows the invited student to supply their own name later', async () => {
    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ students: [{ email: 'student@example.test' }] }),
    })

    expect(response.status).toBe(400)
    const body = await response.json() as any
    expect(body.errors[0].errors).toEqual(['Choose a programme'])
  })

  it('does not treat a phone number as an activation method', async () => {
    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ students: [{ phone: '+2348012345678', programme_id: 'programme-1' }] }),
    })

    expect(response.status).toBe(400)
    const body = await response.json() as any
    expect(body.errors[0].errors).toContain('Email address is required')
  })

  it('rejects duplicate normalized emails before reading or writing account data', async () => {
    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ send_invitations: false, students: [
        { first_name: 'Ada', last_name: 'Okafor', email: 'ADA@example.test', programme_id: 'programme-1' },
        { first_name: 'Grace', last_name: 'Ike', email: ' ada@example.test ', programme_id: 'programme-1' },
      ] }),
    })

    expect(response.status).toBe(400)
    const body = await response.json() as any
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.errors).toEqual([
      { row: 1, errors: ['Email address appears more than once in this import'] },
      { row: 2, errors: ['Email address appears more than once in this import'] },
    ])
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['a staff profile', { id: 'staff-1', role: 'tutor', school_id: 'school-2', email: 'person@example.test' }],
    ['a Learner in another centre', { id: 'student-2', role: 'student', school_id: 'school-2', email: 'person@example.test' }],
  ])('returns the same safe row error for %s', async (_description, profile) => {
    configureImportQueries(profile)

    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ send_invitations: false, students: [{ first_name: 'Ada', last_name: 'Okafor', email: profile.email, programme_id: 'programme-1' }] }),
    })

    expect(response.status).toBe(201)
    const body = await response.json() as any
    expect(body.data.errors).toEqual([{ row: 1, errors: ['Could not add student'] }])
    expect(body.data.errors[0].errors[0]).not.toMatch(/staff|centre|account|email|student already/i)
  })

  it('continues importing a same-centre Learner', async () => {
    configureImportQueries({ id: 'student-1', role: 'student', school_id: 'school-1', email: 'person@example.test', onboarding_status: 'active' })

    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ send_invitations: false, students: [{ first_name: 'Ada', last_name: 'Okafor', email: 'person@example.test', programme_id: 'programme-1' }] }),
    })

    expect(response.status).toBe(201)
    const body = await response.json() as any
    expect(body.data).toMatchObject({ created: 0, enrolled: 1, skipped: 0, errors: [] })
  })

  it('filters operational people lists to active profiles in the selected account', async () => {
    const builders: any[] = []
    mocks.from.mockImplementation((table: string) => {
      const result = table === 'user_profiles' ? { data: [], error: null } : { data: [], error: null }
      const builder = query(result)
      builders.push(builder)
      return builder
    })

    const response = await usersRouter.request('/students')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [] })
    expect(builders[0].eq).toHaveBeenCalledWith('school_id', 'school-1')
    expect(builders[0].eq).toHaveBeenCalledWith('role', 'student')
    expect(builders[0].eq).toHaveBeenCalledWith('is_active', true)
  })

  it.each([
    ['Learner', 'student-1', 'auth-student-1'],
    ['Tutor', 'tutor-1', 'auth-tutor-1'],
  ])('removes a %s through the account-scoped atomic workflow', async (_role, targetId, authId) => {
    mocks.rpc.mockResolvedValue({ data: { found: true, supabase_auth_id: authId }, error: null })
    mocks.updateUserById.mockResolvedValue({ error: null })

    const response = await usersRouter.request(`/${targetId}`, { method: 'DELETE' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'User removed from school' })
    expect(mocks.rpc).toHaveBeenCalledWith('remove_user_from_school', { p_target_user_id: targetId, p_school_id: 'school-1' })
    expect(mocks.updateUserById).toHaveBeenCalledWith(authId, { app_metadata: { school_id: null } })
  })

  it('denies self-removal before invoking the workflow', async () => {
    mocks.user.id = 'admin-1'

    const response = await usersRouter.request('/admin-1', { method: 'DELETE' })

    expect(response.status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('returns not-found without mutation for a cross-account or absent target', async () => {
    mocks.rpc.mockResolvedValue({ data: { found: false }, error: null })

    const response = await usersRouter.request('/other-school-user', { method: 'DELETE' })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ code: 'USER_NOT_FOUND' })
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('maps atomic database failure to a safe retryable response', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } })

    const response = await usersRouter.request('/student-1', { method: 'DELETE' })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Could not remove this user right now', code: 'USER_REMOVAL_UNAVAILABLE' })
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('surfaces Auth projection failure as recoverable post-commit residue', async () => {
    mocks.rpc.mockResolvedValue({ data: { found: true, supabase_auth_id: 'auth-student-1' }, error: null })
    mocks.updateUserById.mockResolvedValue({ error: { message: 'Auth unavailable' } })

    const response = await usersRouter.request('/student-1', { method: 'DELETE' })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'User removed, but session cleanup is pending', code: 'AUTH_PROJECTION_SYNC_FAILED' })
  })
})
