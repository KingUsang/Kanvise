import { describe, expect, it } from 'vitest'
import { resolveStudentCourses } from '../lib/student-course-access'

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
