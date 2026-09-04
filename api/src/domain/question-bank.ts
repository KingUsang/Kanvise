export const QUESTION_TYPES = ['mcq', 'theory'] as const
export const BANK_VISIBILITIES = ['private', 'centre'] as const
export const CONTENT_BLOCK_TYPES = ['text', 'equation', 'chemistry', 'image', 'table'] as const

export type QuestionType = typeof QUESTION_TYPES[number]
export type BankVisibility = typeof BANK_VISIBILITIES[number]

type UnknownRecord = Record<string, unknown>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type QuestionOptionInput = {
  plain_text?: unknown
  content_blocks?: unknown
  is_correct?: unknown
}

export type QuestionInput = {
  question_type?: unknown
  plain_text?: unknown
  content_blocks?: unknown
  explanation_blocks?: unknown
  grading_rubric_blocks?: unknown
  marks?: unknown
  course_id?: unknown
  subject_name?: unknown
  topic?: unknown
  subtopic?: unknown
  stimulus_id?: unknown
  options?: unknown
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function nonBlank(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateContentBlocks(value: unknown, label: string) {
  if (!Array.isArray(value)) return [`${label} must be an array`]
  if (value.length > 100) return [`${label} cannot contain more than 100 blocks`]

  const errors: string[] = []
  value.forEach((block, index) => {
    const blockLabel = `${label} block ${index + 1}`
    if (!isRecord(block) || !CONTENT_BLOCK_TYPES.includes(block.type as any)) {
      errors.push(`${blockLabel} has an unsupported type`)
      return
    }
    if (block.type === 'text' && !nonBlank(block.text)) errors.push(`${blockLabel} needs text`)
    if ((block.type === 'equation' || block.type === 'chemistry') && !nonBlank(block.latex)) {
      errors.push(`${blockLabel} needs LaTeX content`)
    }
    if (block.type === 'image') {
      if (!nonBlank(block.media_id) || !UUID_PATTERN.test(String(block.media_id))) {
        errors.push(`${blockLabel} needs a valid media ID`)
      }
      if (!nonBlank(block.alt_text)) errors.push(`${blockLabel} needs alternative text`)
    }
    if (block.type === 'table' && (!Array.isArray(block.rows) || block.rows.length === 0)) {
      errors.push(`${blockLabel} needs table rows`)
    }
  })
  return errors
}

export function validateQuestionInput(input: QuestionInput, existingType?: QuestionType) {
  const errors: string[] = []
  const questionType = (existingType || input.question_type) as QuestionType
  if (!QUESTION_TYPES.includes(questionType)) errors.push('question_type must be mcq or theory')

  const contentBlocks = input.content_blocks ?? []
  errors.push(...validateContentBlocks(contentBlocks, 'content_blocks'))
  errors.push(...validateContentBlocks(input.explanation_blocks ?? [], 'explanation_blocks'))
  errors.push(...validateContentBlocks(input.grading_rubric_blocks ?? [], 'grading_rubric_blocks'))
  if (!nonBlank(input.plain_text) && Array.isArray(contentBlocks) && contentBlocks.length === 0) {
    errors.push('Question content is required')
  }

  const marks = Number(input.marks)
  if (!Number.isFinite(marks) || marks <= 0 || marks > 10000) errors.push('marks must be between 0 and 10000')

  for (const [field, value] of [['course_id', input.course_id], ['stimulus_id', input.stimulus_id]] as const) {
    if (value != null && value !== '' && (typeof value !== 'string' || !UUID_PATTERN.test(value))) {
      errors.push(`${field} must be a valid UUID`)
    }
  }

  const options = input.options ?? []
  if (!Array.isArray(options)) {
    errors.push('options must be an array')
  } else if (questionType === 'mcq') {
    if (options.length < 2 || options.length > 6) errors.push('MCQ questions need between 2 and 6 options')
    let correct = 0
    options.forEach((rawOption, index) => {
      const option = isRecord(rawOption) ? rawOption as QuestionOptionInput : {}
      const blocks = option.content_blocks ?? []
      errors.push(...validateContentBlocks(blocks, `Option ${index + 1} content_blocks`))
      if (!nonBlank(option.plain_text) && Array.isArray(blocks) && blocks.length === 0) {
        errors.push(`Option ${index + 1} needs content`)
      }
      if (option.is_correct === true) correct += 1
      else if (option.is_correct !== false) errors.push(`Option ${index + 1} needs is_correct`)
    })
    if (correct !== 1) errors.push('MCQ questions need exactly one correct option')
  } else if (questionType === 'theory' && options.length > 0) {
    errors.push('Theory questions cannot have options')
  }

  return [...new Set(errors)]
}

export function canReadQuestionBank(
  user: { id: string; role: string; school_id: string | null },
  bank: { owner_id: string; school_id: string; visibility: string; archived_at?: string | null },
) {
  if (!user.school_id || user.school_id !== bank.school_id || bank.archived_at) return false
  return user.role === 'admin' || bank.owner_id === user.id || bank.visibility === 'centre'
}

export function canEditQuestionBank(
  user: { id: string; role: string; school_id: string | null },
  bank: { owner_id: string; school_id: string; archived_at?: string | null },
) {
  if (!user.school_id || user.school_id !== bank.school_id || bank.archived_at) return false
  return user.role === 'admin' || bank.owner_id === user.id
}

export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`)
}

export function sanitizeQuestionForStudent<T>(question: T): T {
  if (!question || typeof question !== 'object') return question
  const copy: any = structuredClone(question)
  const options = copy.current_version?.options || copy.options
  if (Array.isArray(options)) {
    for (const option of options) delete option.is_correct
  }
  if (copy.current_version) {
    delete copy.current_version.explanation_blocks
    delete copy.current_version.grading_rubric_blocks
  }
  delete copy.explanation_blocks
  delete copy.grading_rubric_blocks
  return copy
}
