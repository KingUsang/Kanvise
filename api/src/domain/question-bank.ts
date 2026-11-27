export const QUESTION_TYPES = ['mcq', 'theory'] as const
export const BANK_VISIBILITIES = ['private', 'centre'] as const
export const CONTENT_BLOCK_TYPES = ['text', 'equation', 'chemistry', 'image', 'table'] as const

export type QuestionType = typeof QUESTION_TYPES[number]
export type BankVisibility = typeof BANK_VISIBILITIES[number]

type UnknownRecord = Record<string, unknown>

// Authoring payload bounds (DEV-QUIZ-009, DEV-QUIZ-010). Generous for real
// papers, small enough to stop nested JSON from exhausting API or database work.
export const QUESTION_LIMITS = {
  plainText: 20_000,
  optionText: 5_000,
  blockText: 20_000,
  latex: 5_000,
  altText: 500,
  label: 160,
  tableRows: 50,
  tableColumns: 20,
  tableCellText: 500,
  marks: 10_000,
} as const

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

function validateTableRows(rows: unknown, blockLabel: string) {
  if (!Array.isArray(rows) || rows.length === 0) return [`${blockLabel} needs table rows`]
  if (rows.length > QUESTION_LIMITS.tableRows) return [`${blockLabel} cannot have more than ${QUESTION_LIMITS.tableRows} table rows`]
  const errors: string[] = []
  let width = -1
  for (const [rowIndex, row] of rows.entries()) {
    if (!Array.isArray(row) || row.length === 0) {
      errors.push(`${blockLabel} table row ${rowIndex + 1} needs cells`)
      continue
    }
    if (row.length > QUESTION_LIMITS.tableColumns) {
      errors.push(`${blockLabel} cannot have more than ${QUESTION_LIMITS.tableColumns} table columns`)
      continue
    }
    if (width === -1) width = row.length
    else if (row.length !== width) errors.push(`${blockLabel} table rows must all have the same number of cells`)
    for (const cell of row) {
      const scalar = typeof cell === 'string' || (typeof cell === 'number' && Number.isFinite(cell))
      if (!scalar) errors.push(`${blockLabel} table cells must be text or numbers`)
      else if (String(cell).length > QUESTION_LIMITS.tableCellText) errors.push(`${blockLabel} table cell is too long`)
    }
  }
  return [...new Set(errors)]
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
    if (block.type === 'text' && nonBlank(block.text) && String(block.text).length > QUESTION_LIMITS.blockText) {
      errors.push(`${blockLabel} text is too long`)
    }
    if ((block.type === 'equation' || block.type === 'chemistry') && !nonBlank(block.latex)) {
      errors.push(`${blockLabel} needs LaTeX content`)
    }
    if ((block.type === 'equation' || block.type === 'chemistry') && nonBlank(block.latex) && String(block.latex).length > QUESTION_LIMITS.latex) {
      errors.push(`${blockLabel} LaTeX content is too long`)
    }
    if (block.type === 'image') {
      if (!nonBlank(block.media_id) || !UUID_PATTERN.test(String(block.media_id))) {
        errors.push(`${blockLabel} needs a valid media ID`)
      }
      if (!nonBlank(block.alt_text)) errors.push(`${blockLabel} needs alternative text`)
      else if (String(block.alt_text).length > QUESTION_LIMITS.altText) errors.push(`${blockLabel} alternative text is too long`)
    }
    if (block.type === 'table') errors.push(...validateTableRows(block.rows, blockLabel))
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
  if (typeof input.plain_text === 'string' && input.plain_text.length > QUESTION_LIMITS.plainText) {
    errors.push(`Question text cannot exceed ${QUESTION_LIMITS.plainText} characters`)
  }
  for (const field of ['subject_name', 'topic', 'subtopic'] as const) {
    const value = input[field]
    if (value != null && (typeof value !== 'string' || value.trim().length > QUESTION_LIMITS.label)) {
      errors.push(`${field.replace('_', ' ')} must be text up to ${QUESTION_LIMITS.label} characters`)
    }
  }

  const marks = Number(input.marks)
  if (!Number.isFinite(marks) || marks <= 0 || marks > QUESTION_LIMITS.marks) errors.push('marks must be between 0 and 10000')

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
      if (typeof option.plain_text === 'string' && option.plain_text.length > QUESTION_LIMITS.optionText) {
        errors.push(`Option ${index + 1} text cannot exceed ${QUESTION_LIMITS.optionText} characters`)
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
