import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }))

import { courseAccessEnrolmentFilter, loadStudentCourseIds } from './student-course-access'

function query(result: any, eqSpy: ReturnType<typeof vi.fn>) {
  const value: any = {
    select: () => value,
    eq: (...args: any[]) => { eqSpy(...args); return value },
    then: (resolve: (data: any) => void) => Promise.resolve(result).then(resolve),
  }
  return value
}

describe('student course access query', () => {
  beforeEach(() => vi.clearAllMocks())

  it('treats an enrolment row as active access without querying a nonexistent status column', async () => {
    const enrolmentFilters = vi.fn()
    mocks.from.mockImplementation((table: string) => {
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
    expect(enrolmentFilters).toHaveBeenCalledWith('student_id', 'student-1')
    expect(enrolmentFilters).toHaveBeenCalledWith('school_id', 'school-1')
    expect(enrolmentFilters).not.toHaveBeenCalledWith('status', 'active')
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
