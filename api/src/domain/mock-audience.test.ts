import { describe, expect, it } from 'vitest'
import { canCreateMockForAudience, validateCentreMockAudience } from './mock-audience'

describe('mock audiences', () => {
  it('accepts a subject, matching combination, direct link, or legacy centre audience', () => {
    expect(validateCentreMockAudience({ audience_scope: 'course', course_id: 'course-1', programme_id: null }))
      .toMatchObject({ scope: 'course', courseId: 'course-1' })
    expect(validateCentreMockAudience({ audience_scope: 'programme', course_id: null, programme_id: 'programme-1' }))
      .toMatchObject({ scope: 'programme', programmeId: 'programme-1' })
    expect(validateCentreMockAudience({ audience_scope: 'school', course_id: null, programme_id: null }))
      .toMatchObject({ scope: 'school' })
    expect(validateCentreMockAudience({ audience_scope: 'combination', course_id: null, programme_id: null }))
      .toMatchObject({ scope: 'combination' })
    expect(validateCentreMockAudience({ audience_scope: 'direct_link', course_id: null, programme_id: null }))
      .toMatchObject({ scope: 'direct_link' })
  })

  it('rejects ambiguous audience targets', () => {
    expect(validateCentreMockAudience({ audience_scope: 'course', course_id: null, programme_id: null })).toHaveProperty('error')
    expect(validateCentreMockAudience({ audience_scope: 'programme', course_id: 'course-1', programme_id: 'programme-1' })).toHaveProperty('error')
    expect(validateCentreMockAudience({ audience_scope: 'school', course_id: 'course-1', programme_id: null })).toHaveProperty('error')
  })

  it('keeps programme-wide and centre-wide creation admin-only', () => {
    expect(canCreateMockForAudience('tutor', 'course')).toBe(true)
    expect(canCreateMockForAudience('tutor', 'direct_link')).toBe(true)
    expect(canCreateMockForAudience('tutor', 'programme')).toBe(false)
    expect(canCreateMockForAudience('tutor', 'school')).toBe(false)
    expect(canCreateMockForAudience('admin', 'school')).toBe(true)
  })
})
