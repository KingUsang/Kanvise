export const SLIDE_POLL_INTERVAL_MS = 1500
export const SLIDE_POLL_TIMEOUT_MS = 130_000

export function hasSlidePollingTimedOut(startedAt: number, now = Date.now()) {
  return now - startedAt >= SLIDE_POLL_TIMEOUT_MS
}
