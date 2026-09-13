import { describe, expect, it } from 'vitest'
import { mockCourseLabel, unusedMockCourses } from './mock-builder-options'

describe('mock builder course choices', () => {
  it('disambiguates the same subject under different courses', () => {
    expect(mockCourseLabel({ id: 'a', name: 'Mathematics', programme: { name: 'JAMB 2027' } })).toBe('JAMB 2027 → Mathematics')
    expect(mockCourseLabel({ id: 'b', name: 'Mathematics', programme: [{ name: 'WAEC 2027' }] })).toBe('WAEC 2027 → Mathematics')
    expect(mockCourseLabel({ id: 'c', name: 'Physics', programme: null })).toBe('Physics · Standalone')
  })

  it('filters by stable course ID rather than duplicate display names', () => {
    const courses = [{ id: 'a', name: 'Mathematics' }, { id: 'b', name: 'Mathematics' }]
    expect(unusedMockCourses(courses, ['a'])).toEqual([{ id: 'b', name: 'Mathematics' }])
  })
})
