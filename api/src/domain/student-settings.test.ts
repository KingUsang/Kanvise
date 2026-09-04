import { describe, expect, it } from 'vitest'
import { validateStudentProfileUpdate } from './student-settings'

describe('student profile updates', () => {
  it('allows only supported profile fields', () => {
    const result = validateStudentProfileUpdate({ first_name: ' Ada ', bio: 'Learner', role: 'admin', school_id: 'other' })
    expect(result).toEqual({ errors: [], updates: { first_name: 'Ada', bio: 'Learner' } })
  })
  it('rejects blank names and oversized biographies', () => {
    const result = validateStudentProfileUpdate({ last_name: ' ', bio: 'x'.repeat(501) })
    expect(result.errors).toHaveLength(2)
  })
})
