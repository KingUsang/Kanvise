/*
 * Kavi's scripted onboarding (02 ONB-01 to ONB-11). Every line is fixed text;
 * there is no AI call. This file holds the questions, Kavi's replies and the
 * state machine, so the chat and the plain form share one source.
 */

export type TeachingMode = 'solo' | 'team'
export type Audience = 'children_teens' | 'adults' | 'both'
export type ClassFormat = 'one_to_one' | 'small_groups' | 'both'

export type OnboardingAnswers = {
  teaching_mode?: TeachingMode
  audience?: Audience
  class_format?: ClassFormat
  subjects?: string[]
  has_students?: boolean
  agency_name?: string
}

/** ONB-09: what an unanswered question falls back to. */
export const ONBOARDING_DEFAULTS = {
  teaching_mode: 'solo',
  audience: 'both',
  class_format: 'both',
  subjects: [] as string[],
  has_students: false,
} as const

export const MAX_SUBJECTS = 10
export const SUBJECT_SUGGESTIONS = ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology', 'Coding', 'Languages', 'Music'] as const
export const SUBJECTS_FULL_LINE = "That's plenty for now. You can add more later."
export const AGENCY_NAME_ERROR = "Add your agency's name."

export type QuestionId = 'teaching_mode' | 'audience' | 'class_format' | 'subjects' | 'has_students'

type Option<T> = { value: T; label: string; reply: string }

export type ChoiceId = Exclude<QuestionId, 'subjects'>
export type ChoiceValue = TeachingMode | Audience | ClassFormat | boolean

export type ChoiceQuestion = {
  id: ChoiceId
  /** ONB-02 to ONB-06 */
  spec: string
  ask: string
  options: Array<Option<ChoiceValue>>
}

export const choiceQuestions: Record<ChoiceId, ChoiceQuestion> = {
  teaching_mode: {
    id: 'teaching_mode',
    spec: 'ONB-02',
    ask: 'Do you teach on your own or with a team?',
    options: [
      { value: 'solo', label: 'On my own', reply: "Okay. I'll leave out the team features for now." },
      { value: 'team', label: 'With a team', reply: "Okay. I'll add a step for inviting your tutors." },
    ] satisfies Array<Option<TeachingMode>>,
  },
  audience: {
    id: 'audience',
    spec: 'ONB-03',
    ask: 'Who do you mostly teach?',
    options: [
      { value: 'children_teens', label: 'Children and teens', reply: "I'll set lessons to 45 minutes and keep what I write short and simple for young readers." },
      { value: 'adults', label: 'Adults', reply: "I'll set lessons to an hour and write for adult readers." },
      { value: 'both', label: 'Both', reply: "I'll set lessons to an hour and match each course's level." },
    ] satisfies Array<Option<Audience>>,
  },
  class_format: {
    id: 'class_format',
    spec: 'ONB-04',
    ask: 'How do you usually teach?',
    options: [
      { value: 'one_to_one', label: 'One-to-one', reply: 'New courses will start with one student.' },
      { value: 'small_groups', label: 'Small groups', reply: 'New courses will start ready for a group.' },
      { value: 'both', label: 'Both', reply: 'New courses will ask each time.' },
    ] satisfies Array<Option<ClassFormat>>,
  },
  has_students: {
    id: 'has_students',
    spec: 'ONB-06',
    ask: 'Do you already have students?',
    options: [
      { value: true, label: 'Yes, I have students', reply: 'Setup starts with importing your list.' },
      { value: false, label: 'Not yet', reply: "There's a sample course you can explore first." },
    ] satisfies Array<Option<boolean>>,
  },
}

export const SUBJECTS_ASK = 'What do you teach?'
export const SUBJECTS_REPLY = "I'll suggest these when you create a course."

/** ONB-01 */
export const GREETING_LINES = (firstName: string) => [
  `Hi ${firstName || 'there'}, I'm Kavi.`,
  'Five quick questions, so Kanvise fits the way you teach. About a minute.',
]
export const AGENCY_ASK = "What's your agency called?"

export const QUESTION_ORDER: QuestionId[] = ['teaching_mode', 'audience', 'class_format', 'subjects', 'has_students']

export type Step = 'hello' | QuestionId | 'agency' | 'saving'

/** The reply Kavi gives after an answer (ONB-02 to ONB-06). */
export function replyFor(id: QuestionId, answers: OnboardingAnswers): string | null {
  if (id === 'subjects') return (answers.subjects?.length ?? 0) > 0 ? SUBJECTS_REPLY : null
  const answer = answers[id]
  if (answer === undefined) return null
  return choiceQuestions[id].options.find((option) => option.value === answer)?.reply ?? null
}

export type OnboardingState = {
  step: Step
  answers: OnboardingAnswers
  /** Questions the person skipped; they keep their ONB-09 default. */
  skipped: QuestionId[]
}

export type OnboardingEvent =
  | { type: 'start' }
  | { type: 'answer'; id: ChoiceId; value: ChoiceValue }
  | { type: 'subjects'; subjects: string[] }
  | { type: 'skip-question' }
  | { type: 'back' }
  | { type: 'agency'; name: string }

export const initialOnboardingState: OnboardingState = { step: 'hello', answers: {}, skipped: [] }

/** Index of the current question, 0 to 4, or null on the hello and agency screens. */
export function questionNumber(step: Step) {
  const index = QUESTION_ORDER.indexOf(step as QuestionId)
  return index === -1 ? null : index
}

/** The step after a question. A team gives its agency name once the last question is done (ONB-07). */
function stepAfter(id: QuestionId, answers: OnboardingAnswers): Step {
  const next = QUESTION_ORDER[QUESTION_ORDER.indexOf(id) + 1]
  if (next) return next
  return answers.teaching_mode === 'team' ? 'agency' : 'saving'
}

export function isTeam(answers: OnboardingAnswers) {
  return answers.teaching_mode === 'team'
}

export function validateAgencyName(value: string): string | null {
  const length = value.trim().length
  return length >= 2 && length <= 80 ? null : AGENCY_NAME_ERROR
}

export function onboardingReducer(state: OnboardingState, event: OnboardingEvent): OnboardingState {
  switch (event.type) {
    case 'start':
      return state.step === 'hello' ? { ...state, step: 'teaching_mode' } : state
    case 'answer': {
      if (state.step !== event.id) return state
      const answers = { ...state.answers, [event.id]: event.value }
      // Changing to solo drops a name typed earlier.
      if (event.id === 'teaching_mode' && event.value === 'solo') delete answers.agency_name
      return { step: stepAfter(event.id, answers), answers, skipped: state.skipped.filter((id) => id !== event.id) }
    }
    case 'subjects': {
      if (state.step !== 'subjects') return state
      const subjects = event.subjects.slice(0, MAX_SUBJECTS)
      // Continue with nothing chosen counts as skipping (ONB-05).
      const answers = { ...state.answers, subjects }
      const skipped = subjects.length === 0 ? [...state.skipped.filter((id) => id !== 'subjects'), 'subjects' as const] : state.skipped.filter((id) => id !== 'subjects')
      return { step: stepAfter('subjects', answers), answers, skipped }
    }
    case 'skip-question': {
      if (!QUESTION_ORDER.includes(state.step as QuestionId)) return state
      const id = state.step as QuestionId
      const answers = { ...state.answers }
      delete answers[id]
      return { step: stepAfter(id, answers), answers, skipped: [...state.skipped.filter((item) => item !== id), id] }
    }
    case 'back': {
      // Going back keeps the previous answer selected.
      if (state.step === 'agency') return { ...state, step: QUESTION_ORDER[QUESTION_ORDER.length - 1] }
      const index = questionNumber(state.step)
      if (index === null || index === 0) return state
      return { ...state, step: QUESTION_ORDER[index - 1] }
    }
    case 'agency': {
      if (state.step !== 'agency' || validateAgencyName(event.name)) return state
      return { ...state, step: 'saving', answers: { ...state.answers, agency_name: event.name.trim() } }
    }
  }
}

/**
 * The body sent to PUT /onboarding. Unanswered questions are left out so the
 * API applies the ONB-09 defaults. The agency name goes only with a team.
 */
export function buildOnboardingPayload(answers: OnboardingAnswers) {
  const body: Record<string, unknown> = {}
  if (answers.teaching_mode !== undefined) body.teaching_mode = answers.teaching_mode
  if (answers.audience !== undefined) body.audience = answers.audience
  if (answers.class_format !== undefined) body.class_format = answers.class_format
  if (answers.subjects !== undefined) body.subjects = answers.subjects
  if (answers.has_students !== undefined) body.has_students = answers.has_students
  if (answers.teaching_mode === 'team' && answers.agency_name) body.agency_name = answers.agency_name.trim()
  return body
}

/** "Skip setup" and "Continue with defaults" (ONB-08, ONB-09). */
export const DEFAULTS_PAYLOAD = { use_defaults: true } as const

/** Subjects for ONB-05: typed values are trimmed and kept once, up to ten. */
export function addSubject(subjects: string[], raw: string): string[] {
  const value = raw.trim().replace(/\s+/g, ' ').slice(0, 40)
  if (!value || subjects.length >= MAX_SUBJECTS) return subjects
  if (subjects.some((subject) => subject.toLowerCase() === value.toLowerCase())) return subjects
  return [...subjects, value]
}
