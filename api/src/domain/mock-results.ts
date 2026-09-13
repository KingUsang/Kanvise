export const REVIEWABLE_ATTEMPT_STATUSES = ['submitted', 'timed_out', 'fully_graded'] as const

export function isReviewableAttemptStatus(status: unknown): boolean {
  return REVIEWABLE_ATTEMPT_STATUSES.includes(status as typeof REVIEWABLE_ATTEMPT_STATUSES[number])
}

export function expectedAnswerFromBlocks(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .filter((block): block is { type: 'text'; text: string } => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text.trim())
    .filter(Boolean)
    .join('\n')
}
