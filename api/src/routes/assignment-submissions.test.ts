import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  verify: vi.fn(),
  presign: vi.fn(),
  user: { id: 'student-1', school_id: 'school-1', role: 'student', kanvise_user_id: 'KNV-STU-1', supabase_auth_id: 'auth-1' },
  account: { id: 'school-1', membershipId: 'membership-1', role: 'learner' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../storage/r2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage/r2')>()
  return { ...actual, verifyPrivateUpload: mocks.verify, createPresignedDownload: mocks.presign }
})
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { if (mocks.account) c.set('account', mocks.account); await next() },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('account')?.role)) return c.json({ code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
}))

import { assignmentsRouter } from './assignments'

function query(result: any, eqSpy = vi.fn()) {
  const builder: any = {
    select: () => builder, insert: () => builder, eq: (...args: any[]) => { eqSpy(...args); return builder },
    or: () => builder, in: () => builder, order: () => builder,
    limit: async () => result, maybeSingle: async () => result, single: async () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

const assignmentId = '11111111-1111-4111-8111-111111111111'
const requestBody = {
  file_key: `schools/school-1/private/submission/${assignmentId}/file.pdf`,
  file_name: 'work.pdf', file_type: 'application/pdf', file_size_bytes: 100,
}

describe('student submission authorization and races', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.role = 'student'; mocks.user.school_id = 'school-1'; mocks.account = { id: 'school-1', membershipId: 'membership-1', role: 'learner' } })

  it('requires canonical account context before submission access', async () => {
    mocks.account = null
    const response = await assignmentsRouter.request(`/${assignmentId}/submit`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody),
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('maps assignment lookup failure to a safe retryable response', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'assignments') return query({ data: null, error: { code: 'DB_DOWN', message: 'secret provider detail' } })
      throw new Error(`Unexpected table ${table}`)
    })
    const response = await assignmentsRouter.request(`/${assignmentId}/submit`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody),
    })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Could not load assignment data right now', code: 'ASSIGNMENT_LOOKUP_FAILED' })
  })

  it('rejects non-students before querying assignment data', async () => {
    mocks.user.role = 'tutor'
    mocks.account.role = 'tutor'
    const response = await assignmentsRouter.request(`/${assignmentId}/submit`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody),
    })
    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an unenrolled student before R2 verification', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'assignments') return query({ data: { id: assignmentId, course_id: 'course-1', deadline_at: '2099-01-01', is_published: true }, error: null })
      if (table === 'student_centre_memberships') return query({ data: { id: 'membership-1' }, error: null })
      if (table === 'courses') return query({ data: [{ id: 'course-1', programme_id: 'programme-1', sub_programme_id: null }], error: null })
      if (table === 'enrolments') return query({ data: [], error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      throw new Error(`Unexpected table ${table}`)
    })
    const response = await assignmentsRouter.request(`/${assignmentId}/submit`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody),
    })
    expect(response.status).toBe(403)
    expect((await response.json() as any).code).toBe('NOT_ENROLLED')
    expect(mocks.verify).not.toHaveBeenCalled()
  })

  it('isolates R2 verification failure from database insertion', async () => {
    let submissionCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'assignments') return query({ data: { id: assignmentId, course_id: 'course-1', deadline_at: '2099-01-01', is_published: true }, error: null })
      if (table === 'student_centre_memberships') return query({ data: { id: 'membership-1' }, error: null })
      if (table === 'courses') return query({ data: [{ id: 'course-1', programme_id: null, sub_programme_id: null }], error: null })
      if (table === 'enrolments') return query({ data: [{ programme_id: null, sub_programme_id: null, course_id: 'course-1' }], error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'submissions') { submissionCalls += 1; return query({ data: null, error: null }) }
      throw new Error(`Unexpected table ${table}`)
    })
    mocks.verify.mockRejectedValue(new Error('R2 unavailable'))
    const response = await assignmentsRouter.request(`/${assignmentId}/submit`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody),
    })
    expect(response.status).toBe(500)
    expect(submissionCalls).toBe(1)
  })

  it('maps a concurrent unique-constraint race to ALREADY_SUBMITTED', async () => {
    let submissionCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'assignments') return query({ data: { id: assignmentId, course_id: 'course-1', deadline_at: '2099-01-01', is_published: true }, error: null })
      if (table === 'student_centre_memberships') return query({ data: { id: 'membership-1' }, error: null })
      if (table === 'courses') return query({ data: [{ id: 'course-1', programme_id: null, sub_programme_id: null }], error: null })
      if (table === 'enrolments') return query({ data: [{ programme_id: null, sub_programme_id: null, course_id: 'course-1' }], error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'submissions') {
        submissionCalls += 1
        if (submissionCalls < 3) return query({ data: null, error: null })
        return query({ data: null, error: { code: '23505' } })
      }
      throw new Error(`Unexpected table ${table}`)
    })
    mocks.verify.mockResolvedValue(true)
    const response = await assignmentsRouter.request(`/${assignmentId}/submit`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody),
    })
    expect(response.status).toBe(409)
    expect((await response.json() as any).code).toBe('ALREADY_SUBMITTED')
  })

  it('returns the committed submission when optional URL signing fails', async () => {
    let submissionCalls = 0
    const committed = { id: 'submission-1', assignment_id: assignmentId, student_id: 'student-1', file_name: 'work.pdf', is_late: false }
    mocks.from.mockImplementation((table: string) => {
      if (table === 'assignments') return query({ data: { id: assignmentId, course_id: 'course-1', deadline_at: '2099-01-01', is_published: true }, error: null })
      if (table === 'student_centre_memberships') return query({ data: { id: 'membership-1' }, error: null })
      if (table === 'courses') return query({ data: [{ id: 'course-1', programme_id: null, sub_programme_id: null }], error: null })
      if (table === 'enrolments') return query({ data: [{ programme_id: null, sub_programme_id: null, course_id: 'course-1' }], error: null })
      if (table === 'sub_programmes') return query({ data: [], error: null })
      if (table === 'submissions') {
        submissionCalls += 1
        if (submissionCalls < 3) return query({ data: null, error: null })
        return query({ data: committed, error: null })
      }
      throw new Error(`Unexpected table ${table}`)
    })
    mocks.verify.mockResolvedValue(true)
    mocks.presign.mockRejectedValue(new Error('R2 unavailable'))

    const response = await assignmentsRouter.request(`/${assignmentId}/submit`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody),
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ data: { id: 'submission-1', download_url: null } })
  })
})
