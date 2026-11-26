import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'student-1', school_id: 'school-1', role: 'student' } as any,
  account: { id: 'school-1', membershipId: 'membership-1', role: 'learner' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/r2', () => ({ publicFileUrl: (key: string) => `https://media.test/${key}` }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { c.set('account', mocks.account); await next() },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('account').role)) return c.json({ code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
  
  requireRole: (...roles: string[]) => async (_c: any, next: () => Promise<void>) => next(),
}))

import { studentSettingsRouter } from './student-settings'

function updateQuery(result: any, eqSpy: ReturnType<typeof vi.fn>) {
  const value: any = {
    update: (payload: unknown) => { value.payload = payload; return value },
    eq: (...args: unknown[]) => { eqSpy(...args); return value },
    select: () => value,
    maybeSingle: async () => result,
  }
  return value
}

describe('student settings security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'student-1', school_id: 'school-1', role: 'student' }
    mocks.account = { id: 'school-1', membershipId: 'membership-1', role: 'learner' }
  })

  it('rejects non-students before reading profile data', async () => {
    mocks.account.role = 'tutor'
    const response = await studentSettingsRouter.request('/students/me/settings')
    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not apply student middleware to unrelated routes', async () => {
    mocks.user.role = 'admin'
    const response = await studentSettingsRouter.request('/programmes/setup', { method: 'POST' })
    expect(response.status).toBe(404)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('ignores role, school and email supplied by the browser', async () => {
    const eqSpy = vi.fn()
    const builder = updateQuery({ data: {
      id: 'student-1', kanvise_user_id: 'KV-1', first_name: 'Ada', last_name: 'Okafor',
      email: 'ada@example.test', bio: null, profile_photo_key: null,
    }, error: null }, eqSpy)
    mocks.from.mockReturnValue(builder)

    const response = await studentSettingsRouter.request('/students/me/settings', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ first_name: 'Ada', role: 'admin', school_id: 'school-2', email: 'hijack@example.test' }),
    })

    expect(response.status).toBe(200)
    expect(builder.payload).toEqual({ first_name: 'Ada' })
    expect(eqSpy).toHaveBeenCalledWith('id', 'student-1')
    expect(eqSpy).not.toHaveBeenCalledWith('school_id', 'school-1')
    expect(eqSpy).not.toHaveBeenCalledWith('role', 'student')
  })

  it('rejects a malformed GET programme UUID before querying', async () => {
    const response = await studentSettingsRouter.request('/students/me/subject-combination?programme_id=not-a-uuid')
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects malformed PUT programme and subject UUIDs before querying', async () => {
    const response = await studentSettingsRouter.request('/students/me/subject-combination', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ programme_id: 'not-a-uuid', course_ids: ['not-a-uuid', '2', '3', '4'] }),
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects malformed course UUIDs before querying', async () => {
    const response = await studentSettingsRouter.request('/students/me/subject-combination', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        programme_id: '11111111-1111-4111-8111-111111111111',
        course_ids: ['22222222-2222-4222-8222-222222222222', 'not-a-uuid', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'],
      }),
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('keeps valid UUID GET selection behavior', async () => {
    const programmeId = '11111111-1111-4111-8111-111111111111'
    const courseId = '22222222-2222-4222-8222-222222222222'
    const builder = (result: any) => {
      const value: any = {
        select: () => value,
        eq: () => value,
        order: () => value,
        maybeSingle: async () => result,
        then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
      }
      return value
    }
    mocks.from.mockImplementation((table: string) => table === 'enrolments'
      ? builder({ data: { id: 'enrolment-1' }, error: null })
      : builder({ data: [{ course_id: courseId, course: { id: courseId, name: 'Physics' } }], error: null }))

    const response = await studentSettingsRouter.request(`/students/me/subject-combination?programme_id=${programmeId}`)
    expect(response.status).toBe(200)
    expect((await response.json() as any).data).toMatchObject({ programme_id: programmeId, course_ids: [courseId] })
    expect(mocks.from).toHaveBeenCalledWith('enrolments')
    expect(mocks.from).toHaveBeenCalledWith('student_programme_subjects')
  })
})
