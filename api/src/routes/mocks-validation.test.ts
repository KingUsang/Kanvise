import { describe, expect, it } from 'vitest'
import { validateMockForPublication } from './mocks'

describe('mock publication validation', () => {
  it('requires at least one question', () => {
    expect(validateMockForPublication([])).toEqual(['Add at least one question before publishing'])
  })

  it('rejects incomplete MCQs', () => {
    const errors = validateMockForPublication([{
      question_text: 'Choose one',
      question_type: 'mcq',
      marks: 2,
      options: [
        { option_text: 'A', is_correct: true },
        { option_text: '', is_correct: false },
      ],
    }])

    expect(errors).toContain('Question 1 needs at least two options')
  })

  it('accepts complete MCQ and theory questions', () => {
    expect(validateMockForPublication([
      {
        question_text: 'Choose one',
        question_type: 'mcq',
        marks: 2,
        options: [
          { option_text: 'A', is_correct: true },
          { option_text: 'B', is_correct: false },
        ],
      },
      { question_text: 'Explain your answer', question_type: 'theory', marks: 5 },
    ])).toEqual([])
  })
})
