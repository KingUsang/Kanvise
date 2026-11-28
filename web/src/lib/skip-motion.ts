/**
 * True when animation should be skipped: the person asked for reduced motion
 * or for data saving (02 ONB-01 "Slow devices"). False on the server.
 */
export function shouldSkipMotion() {
  if (typeof window === 'undefined') return false
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return reduced || connection?.saveData === true
}
