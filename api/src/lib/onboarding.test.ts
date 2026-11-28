import { describe, expect, it } from 'vitest'
import { defaultLessonMinutes, onboardingBodySchema, resolveOnboardingAnswers } from './onboarding'

describe('resolveOnboardingAnswers', () => {
  it('keeps every answer and is not marked as defaults', () => {
    const body = onboardingBodySchema.parse({
      teaching_mode: 'team', audience: 'children_teens', class_format: 'small_groups',
      subjects: ['Mathematics', 'mathematics', 'Physics'], has_students: true, agency_name: 'Science Students Academy',
    })
    expect(resolveOnboardingAnswers(body)).toEqual({
      teaching_mode: 'team', audience: 'children_teens', class_format: 'small_groups',
      subjects: ['Mathematics', 'Physics'], has_students: true, used_defaults: false,
    })
  })

  it('applies the ONB-09 defaults for unanswered questions', () => {
    expect(resolveOnboardingAnswers(onboardingBodySchema.parse({ audience: 'adults' }))).toEqual({
      teaching_mode: 'solo', audience: 'adults', class_format: 'both', subjects: [], has_students: false, used_defaults: true,
    })
  })

  it('ignores answers when continuing with defaults', () => {
    const resolved = resolveOnboardingAnswers(onboardingBodySchema.parse({ use_defaults: true, teaching_mode: 'team', subjects: ['Music'] }))
    expect(resolved).toMatchObject({ teaching_mode: 'solo', subjects: [], used_defaults: true })
  })

  it('does not count empty subjects as a skipped question', () => {
    const resolved = resolveOnboardingAnswers(onboardingBodySchema.parse({ teaching_mode: 'solo', audience: 'both', class_format: 'both', has_students: false }))
    expect(resolved.used_defaults).toBe(false)
  })

  it('rejects unknown fields, bad values, more than ten subjects and short agency names', () => {
    expect(onboardingBodySchema.safeParse({ school_id: 'x' }).success).toBe(false)
    expect(onboardingBodySchema.safeParse({ audience: 'pets' }).success).toBe(false)
    expect(onboardingBodySchema.safeParse({ subjects: Array.from({ length: 11 }, (_, i) => `s${i}`) }).success).toBe(false)
    expect(onboardingBodySchema.safeParse({ agency_name: 'A' }).success).toBe(false)
    expect(onboardingBodySchema.safeParse({ agency_name: 'A'.repeat(81) }).success).toBe(false)
  })
})

describe('defaultLessonMinutes', () => {
  it('uses 45 minutes for children and teens and an hour otherwise', () => {
    expect(defaultLessonMinutes('children_teens')).toBe(45)
    expect(defaultLessonMinutes('adults')).toBe(60)
    expect(defaultLessonMinutes('both')).toBe(60)
  })
})
