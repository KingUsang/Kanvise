import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  updateUserById: vi.fn(),
  createAccountInvitation: vi.fn(),
  sendStudentInvitation: vi.fn(),
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
    upsert: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: any) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

const PROGRAMME_ID = '11111111-1111-4111-8111-111111111111'
const STUDENT_ID = '22222222-2222-4222-8222-222222222222'
const TUTOR_ID = '33333333-3333-4333-8333-333333333333'

function configureImportQueries() {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'programmes') return query({ data: [{ id: PROGRAMME_ID, name: 'Mathematics' }], error: null })
    if (table === 'schools') return query({ data: { name: 'Test Centre' }, error: null })
    throw new Error(`Unexpected table: ${table}`)
  })
}

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc, auth: { admin: { updateUserById: mocks.updateUserById } } } }))
vi.mock('../lib/account-invitations', () => ({ createAccountInvitation: mocks.createAccountInvitation }))
vi.mock('../emails/send-student-invitation', () => ({ sendStudentInvitation: mocks.sendStudentInvitation }))
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
    mocks.createAccountInvitation.mockResolvedValue({ token: 'invite-token', expiresAt: '2026-11-12T00:00:00.000Z' })
    mocks.sendStudentInvitation.mockResolvedValue(undefined)
  })

  it('rejects non-admins before accessing student data', async () => {
    mocks.account.role = 'tutor'
    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ students: [{ first_name: 'Ada', last_name: 'Okafor', email: 'ada@example.test', programme_id: PROGRAMME_ID }] }),
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

  it('validates the invitation email before querying the database', async () => {
    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ students: [{ email: 'not-an-email' }] }),
    })

    expect(response.status).toBe(400)
    const body = await response.json() as any
    expect(body.errors[0].errors).toEqual(['Email address is invalid'])
  })

  it('does not treat a phone number as an activation method', async () => {
    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ students: [{ phone: '+2348012345678', programme_id: PROGRAMME_ID }] }),
    })

    expect(response.status).toBe(400)
    const body = await response.json() as any
    expect(body.errors[0].errors).toContain('Email address is required')
  })

  it('rejects duplicate normalized emails before reading or writing account data', async () => {
    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ send_invitations: false, students: [
        { first_name: 'Ada', last_name: 'Okafor', email: 'ADA@example.test', programme_id: PROGRAMME_ID },
        { first_name: 'Grace', last_name: 'Ike', email: ' ada@example.test ', programme_id: PROGRAMME_ID },
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
    ['a staff profile', { row: 1, ok: false }],
    ['a Learner who cannot be added', { row: 1, ok: false }],
  ])('returns the same safe row error for %s', async (_description, stagedRow) => {
    configureImportQueries()
    mocks.rpc.mockResolvedValue({ data: [stagedRow], error: null })

    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ send_invitations: false, students: [{ first_name: 'Ada', last_name: 'Okafor', email: 'person@example.test', programme_id: PROGRAMME_ID }] }),
    })

    expect(response.status).toBe(201)
    const body = await response.json() as any
    expect(body.data.errors).toEqual([{ row: 1, errors: ['Could not add student'] }])
    expect(body.data.errors[0].errors[0]).not.toMatch(/staff|centre|account|email|student already/i)
  })

  it('stages the roster through one account-scoped database call', async () => {
    configureImportQueries()
    mocks.rpc.mockResolvedValue({ data: [{ row: 1, ok: true, student_profile_id: STUDENT_ID, enrolled: true, onboarding_status: 'active' }], error: null })

    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ send_invitations: false, students: [{ first_name: ' Ada ', last_name: 'Okafor', email: 'Person@Example.test', programme_id: PROGRAMME_ID }] }),
    })

    expect(response.status).toBe(201)
    const body = await response.json() as any
    expect(body.data).toMatchObject({ created: 0, enrolled: 1, skipped: 0, errors: [] })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('import_roster_students', {
      p_school_id: 'school-1',
      p_invited_by: 'admin-1',
      p_rows: [{ row: 1, first_name: 'Ada', last_name: 'Okafor', email: 'person@example.test', phone: null, programme_id: PROGRAMME_ID }],
    })
    expect(mocks.createAccountInvitation).not.toHaveBeenCalled()
  })

  it('commits valid rows while returning bounded errors for a partial import', async () => {
    configureImportQueries()
    mocks.rpc.mockResolvedValue({ data: [
      { row: 1, ok: true, student_profile_id: STUDENT_ID, enrolled: true, onboarding_status: 'active' },
      { row: 2, ok: false },
    ], error: null })

    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ send_invitations: false, students: [
        { first_name: 'Ada', last_name: 'Okafor', email: 'valid@example.test', programme_id: PROGRAMME_ID },
        { first_name: 'Grace', last_name: 'Ike', email: 'external@example.test', programme_id: PROGRAMME_ID },
      ] }),
    })

    expect(response.status).toBe(201)
    const body = await response.json() as any
    expect(body.data).toMatchObject({ created: 0, enrolled: 1, skipped: 1 })
    expect(body.data.errors).toEqual([{ row: 2, errors: ['Could not add student'] }])
  })

  it('keeps the committed roster row and reports delivery failure without provider details', async () => {
    vi.stubEnv('FRONTEND_URL', 'https://app.test')
    configureImportQueries()
    mocks.rpc.mockResolvedValue({ data: [{ row: 1, ok: true, student_profile_id: STUDENT_ID, created: true, pending: true, onboarding_status: 'not_invited', first_name: 'Ada', last_name: 'Okafor' }], error: null })
    mocks.sendStudentInvitation.mockRejectedValue(new Error('SMTP provider secret leaked'))

    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ students: [{ first_name: 'Ada', last_name: 'Okafor', email: 'new@example.test', programme_id: PROGRAMME_ID }] }),
    })

    expect(response.status).toBe(201)
    const body = await response.json() as any
    expect(body.data).toMatchObject({ created: 1, enrolled: 0, pending: 1, invited: 0, invitation_failed: 1, skipped: 0 })
    expect(body.data.errors).toEqual([{ row: 1, errors: [expect.stringContaining('invitation could not be sent')] }])
    expect(JSON.stringify(body)).not.toContain('SMTP provider secret')
    expect(mocks.createAccountInvitation).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 'school-1', role: 'student', studentProfileId: STUDENT_ID, email: 'new@example.test' }))
    expect(mocks.sendStudentInvitation).toHaveBeenCalledOnce()
  })

  it('does not invite Learners who are already active', async () => {
    vi.stubEnv('FRONTEND_URL', 'https://app.test')
    configureImportQueries()
    mocks.rpc.mockResolvedValue({ data: [{ row: 1, ok: true, student_profile_id: STUDENT_ID, onboarding_status: 'active' }], error: null })

    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ students: [{ first_name: 'Ada', last_name: 'Okafor', email: 'active@example.test' }] }),
    })

    expect(response.status).toBe(201)
    expect(mocks.sendStudentInvitation).not.toHaveBeenCalled()
  })

  it('returns a safe retryable error when the staging call fails', async () => {
    configureImportQueries()
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'relation "x" does not exist' } })

    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ send_invitations: false, students: [{ first_name: 'Ada', last_name: 'Okafor', email: 'a@example.test' }] }),
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Could not import students', code: 'IMPORT_UNAVAILABLE' })
  })

  it('rejects unknown or malformed Programme ids before staging', async () => {
    configureImportQueries()
    const response = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ send_invitations: false, students: [{ first_name: 'Ada', last_name: 'Okafor', email: 'a@example.test', programme_id: 'not-a-uuid' }] }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_PROGRAMME' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('rejects an oversized batch and an over-long value', async () => {
    const tooMany = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ students: Array.from({ length: 501 }, (_, i) => ({ email: `s${i}@example.test` })) }),
    })
    expect(tooMany.status).toBe(400)

    const longValue = await usersRouter.request('/students/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ send_invitations: false, students: [{ first_name: 'A'.repeat(101), last_name: 'B', email: 'a@example.test' }] }),
    })
    expect(longValue.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('filters operational people lists to active profiles in the selected account and pages them', async () => {
    const builders: any[] = []
    mocks.from.mockImplementation(() => {
      const builder = query({ data: [], error: null })
      builders.push(builder)
      return builder
    })

    const response = await usersRouter.request('/students')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [], pagination: { limit: 200, offset: 0, has_more: false } })
    expect(builders[0].eq).toHaveBeenCalledWith('school_id', 'school-1')
    expect(builders[0].eq).toHaveBeenCalledWith('role', 'student')
    expect(builders[0].eq).toHaveBeenCalledWith('is_active', true)
    expect(builders[0].range).toHaveBeenCalledWith(0, 200)
  })

  it('reports has_more and trims the extra probe row', async () => {
    const people = Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, role: 'tutor' }))
    mocks.from.mockImplementation((table: string) => query({ data: table === 'user_profiles' ? people : [], error: null }))

    const response = await usersRouter.request('/tutors?limit=2&offset=4')
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(body.data.map((person: any) => person.id)).toEqual(['p0', 'p1'])
    expect(body.pagination).toEqual({ limit: 2, offset: 4, has_more: true })
  })

  it.each(['/students?limit=0', '/students?limit=501', '/tutors?offset=-1', '/?limit=abc'])('rejects an invalid page request %s', async (path) => {
    const response = await usersRouter.request(path)
    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('resends by issuing one replacement invitation and does not write the profile separately', async () => {
    vi.stubEnv('FRONTEND_URL', 'https://app.test')
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return query({ data: { id: STUDENT_ID, email: 'ada@example.test', first_name: 'Ada', last_name: 'Okafor', onboarding_status: 'invited' }, error: null })
      if (table === 'schools') return query({ data: { name: 'Test Centre' }, error: null })
      if (table === 'pending_student_enrolments') return query({ data: [], error: null })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await usersRouter.request(`/students/${STUDENT_ID}/invitation/resend`, { method: 'POST' })

    expect(response.status).toBe(200)
    expect(mocks.createAccountInvitation).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 'school-1', studentProfileId: STUDENT_ID, email: 'ada@example.test' }))
    expect(mocks.sendStudentInvitation).toHaveBeenCalledOnce()
    expect(mocks.from.mock.calls.filter(([table]) => table === 'user_profiles')).toHaveLength(1)
  })

  it('refuses to resend to an already active Learner', async () => {
    mocks.from.mockImplementation(() => query({ data: { id: STUDENT_ID, email: 'a@example.test', onboarding_status: 'active' }, error: null }))

    const response = await usersRouter.request(`/students/${STUDENT_ID}/invitation/resend`, { method: 'POST' })

    expect(response.status).toBe(409)
    expect(mocks.createAccountInvitation).not.toHaveBeenCalled()
  })

  it('cancels an unaccepted invitation through the atomic workflow', async () => {
    mocks.rpc.mockResolvedValue({ data: { found: true, cancelled: true }, error: null })
    const response = await usersRouter.request(`/students/${STUDENT_ID}/invitation`, { method: 'DELETE' })
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('cancel_student_invitation', { p_school_id: 'school-1', p_student_id: STUDENT_ID })
  })

  it.each([
    [{ found: false }, 404, 'NOT_FOUND'],
    [{ found: true, cancelled: false, status: 'active' }, 409, 'STUDENT_ACTIVE'],
  ])('maps cancel result %j to %i', async (data, status, code) => {
    mocks.rpc.mockResolvedValue({ data, error: null })
    const response = await usersRouter.request(`/students/${STUDENT_ID}/invitation`, { method: 'DELETE' })
    expect(response.status).toBe(status)
    expect(await response.json()).toMatchObject({ code })
  })

  it('does not echo database errors when cancelling fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'secret detail' } })
    const response = await usersRouter.request(`/students/${STUDENT_ID}/invitation`, { method: 'DELETE' })
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('secret')
  })

  it.each([
    ['Learner', STUDENT_ID, 'auth-student-1'],
    ['Tutor', TUTOR_ID, 'auth-tutor-1'],
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

    const response = await usersRouter.request(`/${STUDENT_ID}`, { method: 'DELETE' })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ code: 'USER_NOT_FOUND' })
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('returns not-found for a malformed user id without calling the workflow', async () => {
    const response = await usersRouter.request('/not-a-uuid', { method: 'DELETE' })

    expect(response.status).toBe(404)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('maps atomic database failure to a safe retryable response', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } })

    const response = await usersRouter.request(`/${STUDENT_ID}`, { method: 'DELETE' })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Could not remove this user right now', code: 'USER_REMOVAL_UNAVAILABLE' })
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('surfaces Auth projection failure as recoverable post-commit residue', async () => {
    mocks.rpc.mockResolvedValue({ data: { found: true, supabase_auth_id: 'auth-student-1' }, error: null })
    mocks.updateUserById.mockResolvedValue({ error: { message: 'Auth unavailable' } })

    const response = await usersRouter.request(`/${STUDENT_ID}`, { method: 'DELETE' })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'User removed, but session cleanup is pending', code: 'AUTH_PROJECTION_SYNC_FAILED' })
  })
})
