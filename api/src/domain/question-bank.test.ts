import { describe, expect, it } from 'vitest'
import {
  canEditQuestionBank,
  canReadQuestionBank,
  escapeLikePattern,
  sanitizeQuestionForStudent,
  validateQuestionInput,
} from './question-bank'

const schoolA = '10000000-0000-4000-8000-000000000001'
const schoolB = '10000000-0000-4000-8000-000000000002'

describe('question-bank access', () => {
  const owner = { id: 'owner', role: 'tutor', school_id: schoolA }
  const colleague = { id: 'colleague', role: 'tutor', school_id: schoolA }
  const admin = { id: 'admin', role: 'admin', school_id: schoolA }

  it('keeps private banks private while allowing centre banks to colleagues', () => {
    expect(canReadQuestionBank(owner, { owner_id: 'owner', school_id: schoolA, visibility: 'private' })).toBe(true)
    expect(canReadQuestionBank(colleague, { owner_id: 'owner', school_id: schoolA, visibility: 'private' })).toBe(false)
    expect(canReadQuestionBank(colleague, { owner_id: 'owner', school_id: schoolA, visibility: 'centre' })).toBe(true)
  })

  it('never permits cross-school or archived access', () => {
    expect(canReadQuestionBank(admin, { owner_id: 'owner', school_id: schoolB, visibility: 'centre' })).toBe(false)
    expect(canReadQuestionBank(owner, { owner_id: 'owner', school_id: schoolA, visibility: 'private', archived_at: 'now' })).toBe(false)
  })

  it('allows edits only to owners and same-school admins', () => {
    const bank = { owner_id: 'owner', school_id: schoolA }
    expect(canEditQuestionBank(owner, bank)).toBe(true)
    expect(canEditQuestionBank(admin, bank)).toBe(true)
    expect(canEditQuestionBank(colleague, bank)).toBe(false)
  })
})

describe('question authoring validation', () => {
  it('accepts equations, chemistry, and accessible images', () => {
    expect(validateQuestionInput({
      question_type: 'mcq',
      plain_text: 'Choose the balanced equation',
      content_blocks: [
        { type: 'chemistry', latex: String.raw`\ce{H2 + O2 -> H2O}` },
        { type: 'image', media_id: schoolA, alt_text: 'Reaction energy diagram' },
      ],
      explanation_blocks: [{ type: 'equation', latex: '2x = 4' }],
      marks: 2,
      options: [
        { plain_text: 'A', content_blocks: [], is_correct: true },
        { plain_text: 'B', content_blocks: [], is_correct: false },
      ],
    })).toEqual([])
  })

  it('rejects inaccessible images and invalid MCQ answer keys', () => {
    const errors = validateQuestionInput({
      question_type: 'mcq',
      plain_text: '',
      content_blocks: [{ type: 'image', media_id: schoolA }],
      marks: 1,
      options: [
        { plain_text: 'A', content_blocks: [], is_correct: true },
        { plain_text: 'B', content_blocks: [], is_correct: true },
      ],
    })
    expect(errors).toContain('content_blocks block 1 needs alternative text')
    expect(errors).toContain('MCQ questions need exactly one correct option')
  })

  it('rejects options on theory questions', () => {
    expect(validateQuestionInput({
      question_type: 'theory', plain_text: 'Explain', content_blocks: [], marks: 5,
      options: [{ plain_text: 'Not allowed', content_blocks: [], is_correct: false }],
    })).toContain('Theory questions cannot have options')
  })

  describe('payload bounds (DEV-QUIZ-009, DEV-QUIZ-010)', () => {
    const base = { question_type: 'theory' as const, plain_text: 'Explain', marks: 1, options: [] }

    it('accepts a well formed table', () => {
      expect(validateQuestionInput({ ...base, content_blocks: [{ type: 'table', rows: [['a', 'b'], ['1', 2]] }] })).toEqual([])
    })

    it('rejects ragged, oversized and non-scalar tables', () => {
      expect(validateQuestionInput({ ...base, content_blocks: [{ type: 'table', rows: [['a', 'b'], ['c']] }] }))
        .toContain('content_blocks block 1 table rows must all have the same number of cells')
      expect(validateQuestionInput({ ...base, content_blocks: [{ type: 'table', rows: [[{ nested: true }]] }] }))
        .toContain('content_blocks block 1 table cells must be text or numbers')
      expect(validateQuestionInput({ ...base, content_blocks: [{ type: 'table', rows: Array.from({ length: 51 }, () => ['x']) }] }))
        .toContain('content_blocks block 1 cannot have more than 50 table rows')
      expect(validateQuestionInput({ ...base, content_blocks: [{ type: 'table', rows: [Array.from({ length: 21 }, () => 'x')] }] }))
        .toContain('content_blocks block 1 cannot have more than 20 table columns')
      expect(validateQuestionInput({ ...base, content_blocks: [{ type: 'table', rows: [['x'.repeat(501)]] }] }))
        .toContain('content_blocks block 1 table cell is too long')
      expect(validateQuestionInput({ ...base, content_blocks: [{ type: 'table', rows: [[]] }] }))
        .toContain('content_blocks block 1 table row 1 needs cells')
    })

    it('rejects oversized text, option text, labels and marks', () => {
      expect(validateQuestionInput({ ...base, plain_text: 'x'.repeat(20_001) })).toContain('Question text cannot exceed 20000 characters')
      expect(validateQuestionInput({ ...base, content_blocks: [{ type: 'text', text: 'x'.repeat(20_001) }] })).toContain('content_blocks block 1 text is too long')
      expect(validateQuestionInput({ ...base, content_blocks: [{ type: 'equation', latex: 'x'.repeat(5_001) }] })).toContain('content_blocks block 1 LaTeX content is too long')
      expect(validateQuestionInput({ ...base, topic: 't'.repeat(161) })).toContain('topic must be text up to 160 characters')
      expect(validateQuestionInput({ ...base, marks: 10_001 })).toContain('marks must be between 0 and 10000')
      expect(validateQuestionInput({
        question_type: 'mcq', plain_text: 'Q', marks: 1,
        options: [{ plain_text: 'x'.repeat(5_001), is_correct: true }, { plain_text: 'B', is_correct: false }],
      })).toContain('Option 1 text cannot exceed 5000 characters')
    })
  })
})

describe('student response sanitation', () => {
  it('removes answer keys, explanations, and rubrics without mutating author data', () => {
    const authored = {
      current_version: {
        explanation_blocks: [{ type: 'text', text: 'Because' }],
        grading_rubric_blocks: [{ type: 'text', text: 'Two marks' }],
        options: [{ id: 'a', is_correct: true }, { id: 'b', is_correct: false }],
      },
    }
    const student = sanitizeQuestionForStudent(authored)
    expect(student.current_version.options).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(student.current_version).not.toHaveProperty('explanation_blocks')
    expect(authored.current_version.options[0]).toHaveProperty('is_correct', true)
  })

  it('escapes user search wildcards', () => {
    expect(escapeLikePattern('100%_ready\\')).toBe('100\\%\\_ready\\\\')
  })
})
