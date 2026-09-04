import { describe, expect, it } from 'vitest'
import { BANK_QUESTION_TYPE_RELATION } from './postgrest-selects'

describe('PostgREST relationship selects', () => {
  it('disambiguates a question version from a question current-version link', () => {
    expect(BANK_QUESTION_TYPE_RELATION).toBe(
      'question:bank_questions!bank_question_versions_question_id_fkey(question_type)',
    )
  })
})
