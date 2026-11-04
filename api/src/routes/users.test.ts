import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'admin-1', school_id: 'school-1', role: 'admin' } as any,
}))

function query(result: any) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    update: vi.fn(() => builder),
    insert: vi.fn(() => builder),
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

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, auth: { admin: {} } } }))
vi.mock('../storage/r2', () => ({ publicFileUrl: (key: string) => `https://media.test/${key}` }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
}))

import { usersRouter } from './users'

describe('student import access and validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'school-1', role: 'admin' }
  })

  it('rejects non-admins before accessing student data', async () => {
    mocks.user.role = 'tutor'
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
})
