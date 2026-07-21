import { describe, expect, it } from 'vitest'
import { hasSlidePollingTimedOut, SLIDE_POLL_TIMEOUT_MS } from './slide-polling'

describe('slide conversion polling', () => {
  it('continues before the deadline and stops at the deadline', () => {
    const startedAt = 1_000
    expect(hasSlidePollingTimedOut(startedAt, startedAt + SLIDE_POLL_TIMEOUT_MS - 1)).toBe(false)
    expect(hasSlidePollingTimedOut(startedAt, startedAt + SLIDE_POLL_TIMEOUT_MS)).toBe(true)
  })
})
