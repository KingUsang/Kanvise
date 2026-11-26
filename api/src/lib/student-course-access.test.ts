import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }))

import { courseAccessEnrolmentFilter, loadStudentCourseIds } from './student-course-access'

function query(result: any, eqSpy: ReturnType<typeof vi.fn>, maybeSingleResult = result) {
  const value: any = {
    select: () => value,
    eq: (...args: any[]) => { eqSpy(...args); return value },
    maybeSingle: async () => maybeSingleResult,
    then: (resolve: (data: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

describe('student course access query', () => {
  beforeEach(() => vi.clearAllMocks())

  it('treats an enrolment row as active access without querying a nonexistent status column', async () => {
    const membershipFilters = vi.fn()
    const enrolmentFilters = vi.fn()
    mocks.from.mockImplementation((table: string) => {
      if (table === 'student_centre_memberships') return query({ data: { id: 'membership-1' }, error: null }, membershipFilters)
      if (table === 'enrolments') return query({
        data: [{ programme_id: null, sub_programme_id: null, course_id: 'course-1' }],
        error: null,
      }, enrolmentFilters)
      if (table === 'courses') return query({
        data: [{ id: 'course-1', programme_id: null, sub_programme_id: null }],
        error: null,
      }, vi.fn())
      if (table === 'sub_programmes') return query({ data: [], error: null }, vi.fn())
      throw new Error(`Unexpected table ${table}`)
    })

    await expect(loadStudentCourseIds('student-1', 'school-1')).resolves.toEqual(['course-1'])
    expect(membershipFilters).toHaveBeenCalledWith('student_id', 'student-1')
    expect(membershipFilters).toHaveBeenCalledWith('school_id', 'school-1')
    expect(membershipFilters).toHaveBeenCalledWith('status', 'active')
    expect(enrolmentFilters).toHaveBeenCalledWith('student_id', 'student-1')
    expect(enrolmentFilters).toHaveBeenCalledWith('school_id', 'school-1')
    expect(enrolmentFilters).not.toHaveBeenCalledWith('status', 'active')
  })

  it.each([
    ['revoked', { data: null, error: null }],
    ['missing from the requested account', { data: null, error: null }],
  ])('returns no Course grants for a %s membership without downstream queries', async (_description, membershipResult) => {
    const membershipFilters = vi.fn()
    mocks.from.mockImplementation((table: string) => {
      if (table === 'student_centre_memberships') return query(membershipResult, membershipFilters)
      throw new Error(`Unexpected downstream table ${table}`)
    })

    await expect(loadStudentCourseIds('student-1', 'school-2')).resolves.toEqual([])
    expect(membershipFilters).toHaveBeenCalledWith('student_id', 'student-1')
    expect(membershipFilters).toHaveBeenCalledWith('school_id', 'school-2')
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('fails safely on membership lookup failure without querying downstream tables', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'student_centre_memberships') return query({ data: null, error: { message: 'database unavailable' } }, vi.fn())
      throw new Error(`Unexpected downstream table ${table}`)
    })

    await expect(loadStudentCourseIds('student-1', 'school-1')).rejects.toThrow('Could not resolve student course access')
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
})

describe('course notification recipient filters', () => {
  it('includes direct, sub-programme, and parent-programme enrolments for a nested course', () => {
    expect(courseAccessEnrolmentFilter({
      id: 'course-1', programme_id: null, sub_programme_id: 'sub-1',
    }, { id: 'sub-1', programme_id: 'programme-1' })).toBe(
      'course_id.eq.course-1,sub_programme_id.eq.sub-1,programme_id.eq.programme-1',
    )
  })

  it('includes a programme enrolment for a direct programme course', () => {
    expect(courseAccessEnrolmentFilter({
      id: 'course-1', programme_id: 'programme-1', sub_programme_id: null,
    })).toBe('course_id.eq.course-1,programme_id.eq.programme-1')
  })
})
