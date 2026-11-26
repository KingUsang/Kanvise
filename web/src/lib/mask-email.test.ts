import { describe, expect, it } from 'vitest'
import { maskEmail } from './mask-email'

describe('maskEmail', () => {
  it('keeps the destination recognisable without exposing the full address', () => {
    expect(maskEmail('student@example.com')).toBe('st•••••@example.com')
    expect(maskEmail('a@example.com')).toBe('a•••@example.com')
  })

  it('leaves malformed input unchanged', () => {
    expect(maskEmail('not-an-email')).toBe('not-an-email')
  })
})
