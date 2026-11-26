import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  user: { id: 'admin-1', school_id: 'legacy-school', role: 'admin' } as any,
  account: { id: 'account-1', membershipId: 'membership-1', role: 'admin' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../middleware/auth', () => ({
  ACCOUNT_CONTEXT_HEADER: 'X-Kanvise-Account-Id',
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', mocks.user)
    await next()
  },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    if (!mocks.account) return c.json({ error: 'A valid tutoring account must be selected', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
    c.set('account', mocks.account)
    await next()
  },
}))

import { resolveStudentCourses } from '../lib/student-course-access'
import { dashboardRouter } from './dashboard'

function query(result: any) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

const courses = [
  { id: 'direct', name: 'Direct course', programme_id: null, sub_programme_id: null },
  { id: 'programme-child', name: 'Programme course', programme_id: 'programme-1', sub_programme_id: null },
  { id: 'sub-child', name: 'Sub-programme course', programme_id: null, sub_programme_id: 'sub-1' },
  { id: 'programme-sub-child', name: 'Programme sub-course', programme_id: null, sub_programme_id: 'sub-under-programme-1' },
  { id: 'other', name: 'Other course', programme_id: 'programme-2', sub_programme_id: null },
]

describe('resolveStudentCourses', () => {
  it('combines direct, programme, and sub-programme access without leaking other courses', () => {
    const result = resolveStudentCourses([
      { programme_id: null, sub_programme_id: null, course_id: 'direct' },
      { programme_id: 'programme-1', sub_programme_id: null, course_id: null },
      { programme_id: null, sub_programme_id: 'sub-1', course_id: null },
    ], courses, [{ id: 'sub-under-programme-1', programme_id: 'programme-1' }])

    expect(result.map((course) => course.id)).toEqual(['direct', 'programme-child', 'sub-child', 'programme-sub-child'])
  })

  it('returns no courses when the student has no enrolments', () => {
    expect(resolveStudentCourses([], courses)).toEqual([])
  })
})

describe('dashboard account policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'admin-1', school_id: 'legacy-school', role: 'admin' }
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'admin' }
  })

  it('requires a selected active account for account-backed capabilities', async () => {
    mocks.account = null

    const response = await dashboardRouter.request('/capabilities')

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('projects the selected account instead of trusting profile school_id', async () => {
    const assignmentQuery = query({ data: null, error: null })
    const schoolQuery = query({ data: { account_type: 'centre' }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'tutor_course_assignments') return assignmentQuery
      if (table === 'schools') return schoolQuery
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await dashboardRouter.request('/capabilities')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { is_admin: true, is_tutor: false } })
    expect(schoolQuery.eq).toHaveBeenCalledWith('id', 'account-1')
    expect(schoolQuery.eq).not.toHaveBeenCalledWith('id', 'legacy-school')
  })
})
