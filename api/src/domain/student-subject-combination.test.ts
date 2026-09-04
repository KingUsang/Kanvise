import { describe, expect, it } from 'vitest'
import { validateStudentSubjectCombination } from './student-subject-combination'

describe('student subject combinations', () => {
  it('accepts four distinct course identifiers', () => {
    expect(validateStudentSubjectCombination(['eng', 'math', 'phy', 'chem'])).toEqual({ courseIds: ['eng', 'math', 'phy', 'chem'] })
  })

  it('rejects the wrong count and duplicate subjects', () => {
    expect(validateStudentSubjectCombination(['eng', 'math'])).toHaveProperty('error')
    expect(validateStudentSubjectCombination(['eng', 'math', 'phy', 'phy'])).toHaveProperty('error')
  })
})
