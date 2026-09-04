export const CALCULATOR_MODES = ['none', 'basic', 'scientific'] as const
export const RESULT_RELEASE_MODES = [
  'score_only',
  'immediately_with_corrections',
  'after_close',
  'after_theory_grading',
] as const

type AssemblyQuestion = {
  question_id?: unknown
  question_version_id?: unknown
  marks_override?: unknown
}

type AssemblyRule = {
  bank_id?: unknown
  subject_name?: unknown
  topic?: unknown
  subtopic?: unknown
  question_type?: unknown
  question_count?: unknown
}

export type MockAssemblySection = {
  title?: unknown
  course_id?: unknown
  subject_name?: unknown
  instructions?: unknown
  questions?: unknown
  rules?: unknown
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function optionalText(value: unknown, maxLength: number) {
  return value == null || value === '' || (typeof value === 'string' && value.trim().length <= maxLength)
}

export function validateMockAssembly(value: unknown) {
  if (!Array.isArray(value)) return ['Sections must be an array']
  if (!value.length) return ['Add at least one section']

  const errors: string[] = []
  const questionIds = new Set<string>()
  value.forEach((section: MockAssemblySection, sectionIndex) => {
    const label = `Section ${sectionIndex + 1}`
    if (!section || typeof section !== 'object') {
      errors.push(`${label} is invalid`)
      return
    }
    if (typeof section.title !== 'string' || !section.title.trim() || section.title.trim().length > 160) {
      errors.push(`${label} needs a title up to 160 characters`)
    }
    if (section.course_id && (typeof section.course_id !== 'string' || !UUID_PATTERN.test(section.course_id))) {
      errors.push(`${label} has an invalid course`)
    }
    if (!optionalText(section.subject_name, 160) || !optionalText(section.instructions, 4000)) {
      errors.push(`${label} has text that is too long`)
    }

    const questions = section.questions ?? []
    if (!Array.isArray(questions)) errors.push(`${label} questions must be an array`)
    else questions.forEach((question: AssemblyQuestion, questionIndex) => {
      const questionLabel = `${label}, question ${questionIndex + 1}`
      if (!question || typeof question.question_id !== 'string' || !UUID_PATTERN.test(question.question_id)) {
        errors.push(`${questionLabel} has an invalid question`)
        return
      }
      if (questionIds.has(question.question_id)) errors.push(`${questionLabel} is already used in this mock`)
      questionIds.add(question.question_id)
      if (question.question_version_id && (typeof question.question_version_id !== 'string' || !UUID_PATTERN.test(question.question_version_id))) {
        errors.push(`${questionLabel} has an invalid version`)
      }
      if (question.marks_override != null && question.marks_override !== ''
        && (!Number.isFinite(Number(question.marks_override)) || Number(question.marks_override) <= 0)) {
        errors.push(`${questionLabel} needs positive marks`)
      }
    })

    const rules = section.rules ?? []
    if (!Array.isArray(rules)) errors.push(`${label} random rules must be an array`)
    else rules.forEach((rule: AssemblyRule, ruleIndex) => {
      const ruleLabel = `${label}, random rule ${ruleIndex + 1}`
      if (!rule || typeof rule.bank_id !== 'string' || !UUID_PATTERN.test(rule.bank_id)) {
        errors.push(`${ruleLabel} has an invalid question bank`)
      }
      if (!Number.isInteger(Number(rule.question_count)) || Number(rule.question_count) < 1 || Number(rule.question_count) > 500) {
        errors.push(`${ruleLabel} must select between 1 and 500 questions`)
      }
      if (rule.question_type && !['mcq', 'theory'].includes(String(rule.question_type))) {
        errors.push(`${ruleLabel} has an invalid question type`)
      }
      for (const field of ['subject_name', 'topic', 'subtopic'] as const) {
        if (!optionalText(rule[field], 160)) errors.push(`${ruleLabel} has an invalid ${field.replace('_', ' ')}`)
      }
    })

    if (Array.isArray(questions) && Array.isArray(rules) && questions.length + rules.length === 0) {
      errors.push(`${label} needs at least one question or random rule`)
    }
  })
  return errors
}

export function referencedAssemblyIds(sections: MockAssemblySection[]) {
  const questionIds = new Set<string>()
  const bankIds = new Set<string>()
  const courseIds = new Set<string>()
  for (const section of sections) {
    if (typeof section.course_id === 'string' && section.course_id) courseIds.add(section.course_id)
    if (Array.isArray(section.questions)) {
      for (const question of section.questions as AssemblyQuestion[]) {
        if (typeof question.question_id === 'string') questionIds.add(question.question_id)
      }
    }
    if (Array.isArray(section.rules)) {
      for (const rule of section.rules as AssemblyRule[]) {
        if (typeof rule.bank_id === 'string') bankIds.add(rule.bank_id)
      }
    }
  }
  return { questionIds: [...questionIds], bankIds: [...bankIds], courseIds: [...courseIds] }
}

export function normalizeMockSettings(body: Record<string, unknown>) {
  const errors: string[] = []
  const updates: Record<string, unknown> = {}
  const calculatorMode = body.calculator_mode
  const releaseMode = body.result_release_mode
  if (calculatorMode !== undefined) {
    if (!CALCULATOR_MODES.includes(calculatorMode as any)) errors.push('Choose a valid calculator mode')
    else updates.calculator_mode = calculatorMode
  }
  if (releaseMode !== undefined) {
    if (!RESULT_RELEASE_MODES.includes(releaseMode as any)) errors.push('Choose a valid result release option')
    else updates.result_release_mode = releaseMode
  }
  for (const field of ['shuffle_questions', 'shuffle_options'] as const) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'boolean') errors.push(`${field.replace('_', ' ')} must be true or false`)
      else updates[field] = body[field]
    }
  }
  if (body.max_attempts !== undefined) {
    const value = Number(body.max_attempts)
    if (!Number.isInteger(value) || value < 1 || value > 20) errors.push('Attempts must be between 1 and 20')
    else updates.max_attempts = value
  }
  if (body.pass_mark !== undefined) {
    const value = body.pass_mark === null || body.pass_mark === '' ? null : Number(body.pass_mark)
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) errors.push('Pass mark must be between 0 and 100')
    else updates.pass_mark = value
  }
  const dates: Record<string, Date | null> = {}
  for (const field of ['available_from', 'closes_at'] as const) {
    if (body[field] !== undefined) {
      const date = body[field] == null || body[field] === '' ? null : new Date(String(body[field]))
      if (date && Number.isNaN(date.getTime())) errors.push(`${field.replace('_', ' ')} must be a valid date`)
      else {
        dates[field] = date
        updates[field] = date?.toISOString() || null
      }
    }
  }
  if (dates.available_from && dates.closes_at && dates.closes_at <= dates.available_from) {
    errors.push('Closing time must be after the opening time')
  }
  return { errors, updates }
}
