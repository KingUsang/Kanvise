export const JAMB_SUBJECT_COUNT = 4

export function validateStudentSubjectCombination(input: unknown) {
  if (!Array.isArray(input) || input.length !== JAMB_SUBJECT_COUNT) {
    return { error: `Choose exactly ${JAMB_SUBJECT_COUNT} subjects` } as const
  }
  if (!input.every((value) => typeof value === 'string' && value.trim())) {
    return { error: 'Each selected subject must be valid' } as const
  }
  const courseIds = input.map((value) => value.trim())
  if (new Set(courseIds).size !== courseIds.length) return { error: 'Choose each subject only once' } as const
  return { courseIds } as const
}
