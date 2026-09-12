import { describe, expect, it } from 'vitest'
import { expectedAnswerFromBlocks, isReviewableAttemptStatus, REVIEWABLE_ATTEMPT_STATUSES } from './mock-results'

describe('mock result review states', () => {
  it('excludes an attempt while the student is still taking it', () => {
    expect(isReviewableAttemptStatus('in_progress')).toBe(false)
  })

  it.each(REVIEWABLE_ATTEMPT_STATUSES)('allows tutors to review %s attempts', (status) => {
    expect(isReviewableAttemptStatus(status)).toBe(true)
  })

  it('turns private text rubric blocks into the expected answer shown while grading', () => {
    expect(expectedAnswerFromBlocks([
      { type: 'text', text: ' Defines osmosis. ' },
      { type: 'equation', latex: 'x=1' },
      { type: 'text', text: 'Mentions a semi-permeable membrane.' },
    ])).toBe('Defines osmosis.\nMentions a semi-permeable membrane.')
    expect(expectedAnswerFromBlocks(null)).toBe('')
  })
})
