import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  user: { id: 'student-1', school_id: 'school-1', role: 'student' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('../storage/r2', () => ({ createPresignedDownload: vi.fn(async () => 'signed-url') }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('user').role)) return c.json({ code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
}))

import { studentMocksRouter, studentQuestionVersionSelect } from './student-mocks'

function query(result: any, eqSpy = vi.fn()) {
  const value: any = {
    select: () => value,
    eq: (...args: any[]) => { eqSpy(...args); return value },
    in: () => value,
    is: () => value,
    order: () => value,
    limit: () => value,
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

function enrolmentTables(enrolled: boolean) {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'enrolments') return query({ data: enrolled
      ? [{ programme_id: null, sub_programme_id: null, course_id: 'course-1' }] : [], error: null })
    if (table === 'courses') return query({ data: [{ id: 'course-1', programme_id: null, sub_programme_id: null }], error: null })
    if (table === 'sub_programmes') return query({ data: [], error: null })
    if (table === 'mock_exams') return query({ data: {
      id: 'mock-1', school_id: 'school-1', course_id: 'course-1', status: 'published',
      available_from: null, closes_at: null, max_attempts: 1,
    }, error: null })
    throw new Error(`Unexpected table ${table}`)
  })
}

describe('student mock security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'student-1', school_id: 'school-1', role: 'student' }
  })

  it('rejects tutors before any student mock data is queried', async () => {
    mocks.user.role = 'tutor'
    const response = await studentMocksRouter.request('/students/me/mocks')
    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('hides preflight data from an unenrolled student', async () => {
    enrolmentTables(false)
    const response = await studentMocksRouter.request('/mocks/mock-1/preflight')
    expect(response.status).toBe(404)
    expect((await response.json() as any).code).toBe('MOCK_NOT_FOUND')
    expect(mocks.from).not.toHaveBeenCalledWith('mock_exams')
  })

  it('uses the authenticated student and school when starting an attempt', async () => {
    enrolmentTables(true)
    mocks.rpc.mockResolvedValue({ data: [{ attempt_id: 'attempt-1', resumed: false }], error: null })
    const response = await studentMocksRouter.request('/mocks/mock-1/attempts', { method: 'POST' })
    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith('start_or_resume_versioned_mock_attempt', expect.objectContaining({
      p_school_id: 'school-1', p_student_id: 'student-1', p_mock_exam_id: 'mock-1',
    }))
  })

  it('never accepts a browser-supplied student or school when saving an answer', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'mock_attempts') return query({ data: { school_id: 'school-1' }, error: null })
      return query({ data: null, error: null })
    })
    mocks.rpc.mockResolvedValue({ data: [{ answer_id: 'answer-1' }], error: null })
    const response = await studentMocksRouter.request('/attempts/attempt-1/answers/question-1', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ selected_option_version_id: 'option-1', student_id: 'student-2', school_id: 'school-2' }),
    })
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('save_versioned_mock_answer', expect.objectContaining({
      p_school_id: 'school-1', p_student_id: 'student-1', p_attempt_id: 'attempt-1',
    }))
  })

  it('uses the owning-question relationship when loading a question version', () => {
    expect(studentQuestionVersionSelect).toContain('bank_questions!bank_question_versions_question_id_fkey')
  })
})
