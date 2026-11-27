import { describe, expect, it } from 'vitest'
import { formatDeadline } from './format-deadline'

describe('formatDeadline', () => {
  it('includes date, time and timezone name', () => {
    const text = formatDeadline('2026-05-01T10:30:00.000Z')
    expect(text).toMatch(/2026/)
    expect(text).toMatch(/\d{1,2}:30/)
    expect(text).toMatch(/[A-Z]{2,5}|GMT[+-]\d+/)
  })
  it('does not throw on invalid input', () => {
    expect(formatDeadline('nope')).toBe('Date unavailable')
  })
})
