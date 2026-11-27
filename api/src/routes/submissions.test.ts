import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  notify: vi.fn(),
  account: { id: 'school-1', membershipId: 'membership-1', role: 'tutor' } as any,
  user: { id: 'tutor-1', school_id: 'school-1', role: 'tutor' },
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../notifications/triggers', () => ({ notifySubmissionGraded: mocks.notify }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => { if (mocks.account) c.set('account', mocks.account); await next() },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('account')?.role)) return c.json({ error: 'forbidden' }, 403)
    await next()
  },
}))

import { submissionsRouter } from './submissions'

function query(result: any) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    update: () => builder,
    single: async () => result,
    maybeSingle: async () => result,
  }
  return builder
}

describe('submission review account boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.account = { id: 'school-1', membershipId: 'membership-1', role: 'tutor' }
    mocks.notify.mockResolvedValue(null)
  })

  it('requires canonical active account context before reading a submission', async () => {
    mocks.account = null
    const response = await submissionsRouter.request('/submission-1/review', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score: 80 }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a safe retryable response for a dependency failure', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: { code: 'DB_DOWN', message: 'provider details' } }))
    const response = await submissionsRouter.request('/submission-1/review', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score: 80 }),
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Could not load this submission right now', code: 'SUBMISSION_LOOKUP_FAILED' })
  })

  it('distinguishes a missing submission from a failed lookup', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    const response = await submissionsRouter.request('/submission-1/review', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score: 80 }),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Submission not found', code: 'NOT_FOUND' })
  })

  const submissionRow = { id: 'submission-1', school_id: 'school-1', student_id: 's1', assignment_id: 'a1', assignment: { id: 'a1', title: 'Essay', tutor_id: 'creator-1', course_id: 'course-1' } }

  function tables(tutorAssignment: any, updated: any = { ...submissionRow, score: 80 }) {
    let submissionCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'submissions') { submissionCalls += 1; return query({ data: submissionCalls === 1 ? submissionRow : updated, error: null }) }
      if (table === 'courses') return query({ data: { id: 'course-1' }, error: null })
      if (table === 'tutor_course_assignments') return query({ data: tutorAssignment, error: null })
      throw new Error(`Unexpected table ${table}`)
    })
  }
  const review = (body: unknown) => submissionsRouter.request('/submission-1/review', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })

  it.each([{ score: -1 }, { score: 100.5 }, { score: '80' }, { score: null }, {}, { score: 50, feedback: 'x'.repeat(5001) }, { score: 50, extra: true }])(
    'rejects an invalid review body %j before any query', async (body) => {
      const response = await review(body)
      expect(response.status).toBe(400)
      expect((await response.json() as any).code).toBe('VALIDATION_ERROR')
      expect(mocks.from).not.toHaveBeenCalled()
    })

  it('lets a Tutor assigned to the Course grade work created by another Tutor', async () => {
    tables({ id: 'tca-1' })
    mocks.notify.mockResolvedValue(null)
    const response = await review({ score: 100, feedback: 'Well done' })
    expect(response.status).toBe(200)
  })

  it('denies a Tutor who is not assigned to the Course', async () => {
    tables(null)
    const response = await review({ score: 80 })
    expect(response.status).toBe(403)
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('returns 503 when the course assignment lookup fails', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'submissions') return query({ data: submissionRow, error: null })
      if (table === 'courses') return query({ data: { id: 'course-1' }, error: null })
      return query({ data: null, error: { code: 'DB_DOWN' } })
    })
    const response = await review({ score: 80 })
    expect(response.status).toBe(503)
    expect((await response.json() as any).code).toBe('SUBMISSION_ACCESS_FAILED')
  })
})
