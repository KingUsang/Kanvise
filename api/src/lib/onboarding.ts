import { z } from 'zod'

/** Answers and defaults from 02-onboarding-and-setup (ONB-02 to ONB-09). */
export const TEACHING_MODES = ['solo', 'team'] as const
export const AUDIENCES = ['children_teens', 'adults', 'both'] as const
export const CLASS_FORMATS = ['one_to_one', 'small_groups', 'both'] as const
export const SKIPPABLE_STEPS = ['course_plan'] as const
export const MAX_SUBJECTS = 10

export type TeachingMode = (typeof TEACHING_MODES)[number]
export type Audience = (typeof AUDIENCES)[number]
export type ClassFormat = (typeof CLASS_FORMATS)[number]

/** ONB-09: what an unanswered question falls back to. */
export const ONBOARDING_DEFAULTS = {
  teaching_mode: 'solo',
  audience: 'both',
  class_format: 'both',
  subjects: [] as string[],
  has_students: false,
} as const

export const onboardingBodySchema = z.object({
  teaching_mode: z.enum(TEACHING_MODES).optional(),
  audience: z.enum(AUDIENCES).optional(),
  class_format: z.enum(CLASS_FORMATS).optional(),
  subjects: z.array(z.string().trim().min(1).max(40)).max(MAX_SUBJECTS).optional(),
  has_students: z.boolean().optional(),
  // ONB-07: required, 2 to 80 characters, only for a team.
  agency_name: z.string().trim().min(2).max(80).optional(),
  // "Continue with defaults" (ONB-08) sends this with no answers.
  use_defaults: z.boolean().optional(),
}).strict()

export type OnboardingBody = z.infer<typeof onboardingBodySchema>

function uniqueSubjects(subjects: string[]) {
  const seen = new Set<string>()
  return subjects.filter((subject) => {
    const key = subject.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** The row to store: unanswered questions take their ONB-09 default. */
export function resolveOnboardingAnswers(body: OnboardingBody) {
  const answered = !body.use_defaults
  return {
    teaching_mode: (answered ? body.teaching_mode : undefined) ?? ONBOARDING_DEFAULTS.teaching_mode,
    audience: (answered ? body.audience : undefined) ?? ONBOARDING_DEFAULTS.audience,
    class_format: (answered ? body.class_format : undefined) ?? ONBOARDING_DEFAULTS.class_format,
    subjects: answered && body.subjects ? uniqueSubjects(body.subjects) : [],
    has_students: (answered ? body.has_students : undefined) ?? ONBOARDING_DEFAULTS.has_students,
    // Subjects may stay empty without counting as a skipped question.
    used_defaults: !answered
      || body.teaching_mode === undefined
      || body.audience === undefined
      || body.class_format === undefined
      || body.has_students === undefined,
  }
}

/** ONB-03: lesson length follows who the tutor teaches. */
export function defaultLessonMinutes(audience: Audience) {
  return audience === 'children_teens' ? 45 : 60
}
