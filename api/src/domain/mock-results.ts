export const REVIEWABLE_ATTEMPT_STATUSES = ['submitted', 'timed_out', 'fully_graded'] as const

export function isReviewableAttemptStatus(status: unknown): boolean {
  return REVIEWABLE_ATTEMPT_STATUSES.includes(status as typeof REVIEWABLE_ATTEMPT_STATUSES[number])
}
