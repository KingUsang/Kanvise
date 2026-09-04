import { describe, expect, it } from 'vitest'
import { isReviewableAttemptStatus, REVIEWABLE_ATTEMPT_STATUSES } from './mock-results'

describe('mock result review states', () => {
  it('excludes an attempt while the student is still taking it', () => {
    expect(isReviewableAttemptStatus('in_progress')).toBe(false)
  })

  it.each(REVIEWABLE_ATTEMPT_STATUSES)('allows tutors to review %s attempts', (status) => {
    expect(isReviewableAttemptStatus(status)).toBe(true)
  })
})
