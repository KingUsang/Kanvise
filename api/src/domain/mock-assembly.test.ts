import { describe, expect, it } from 'vitest'
import { normalizeMockSettings, referencedAssemblyIds, validateMockAssembly } from './mock-assembly'

const id = (suffix: number) => `10000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`

describe('mock assembly validation', () => {
  it('accepts fixed and random questions arranged into sections', () => {
    const sections = [{
      title: 'Mathematics', course_id: id(1),
      questions: [{ question_id: id(2), marks_override: 2 }],
      rules: [{ bank_id: id(3), topic: 'Algebra', question_type: 'mcq', question_count: 10 }],
    }]
    expect(validateMockAssembly(sections)).toEqual([])
    expect(referencedAssemblyIds(sections)).toEqual({
      questionIds: [id(2)], bankIds: [id(3)], courseIds: [id(1)],
    })
  })

  it('rejects empty sections, duplicate questions, and invalid pool sizes', () => {
    const sections = [
      { title: 'One', questions: [{ question_id: id(2) }], rules: [] },
      { title: 'Two', questions: [{ question_id: id(2) }], rules: [{ bank_id: id(3), question_count: 0 }] },
    ]
    const errors = validateMockAssembly(sections)
    expect(errors).toContain('Section 2, question 1 is already used in this mock')
    expect(errors).toContain('Section 2, random rule 1 must select between 1 and 500 questions')
  })
})

describe('mock settings validation', () => {
  it('normalizes supported settings and availability dates', () => {
    const result = normalizeMockSettings({
      calculator_mode: 'scientific', result_release_mode: 'after_close',
      shuffle_questions: true, shuffle_options: false, max_attempts: 2,
      pass_mark: '50', available_from: '2026-08-01T09:00:00+01:00',
      closes_at: '2026-08-01T11:00:00+01:00',
    })
    expect(result.errors).toEqual([])
    expect(result.updates).toMatchObject({ calculator_mode: 'scientific', pass_mark: 50, max_attempts: 2 })
  })

  it('rejects unsupported modes and reversed availability', () => {
    const result = normalizeMockSettings({
      calculator_mode: 'phone', max_attempts: 0,
      available_from: '2026-08-01T11:00:00Z', closes_at: '2026-08-01T09:00:00Z',
    })
    expect(result.errors).toContain('Choose a valid calculator mode')
    expect(result.errors).toContain('Attempts must be between 1 and 20')
    expect(result.errors).toContain('Closing time must be after the opening time')
  })
})
