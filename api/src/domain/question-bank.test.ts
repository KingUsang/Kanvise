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
