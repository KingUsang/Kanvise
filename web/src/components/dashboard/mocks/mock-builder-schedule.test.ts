import { describe, expect, it } from 'vitest'
import { toLocalDateInput, toLocalDateTimeInput, toLocalTimeInput } from './mock-builder-schedule'

describe('builder schedule conversion', () => {
  const local = new Date(2026, 8, 9, 23, 30)

  it('reads a stored instant back as the same local wall-clock value', () => {
    expect(toLocalDateTimeInput(local.toISOString())).toBe('2026-09-09T23:30')
    expect(toLocalDateInput(local.toISOString())).toBe('2026-09-09')
    expect(toLocalTimeInput(local.toISOString())).toBe('23:30')
  })

  it('round-trips through the save conversion without shifting', () => {
    const stored = new Date(toLocalDateTimeInput(local.toISOString())).toISOString()
    expect(stored).toBe(local.toISOString())
    const early = new Date(2026, 0, 1, 0, 5)
    expect(new Date(`${toLocalDateInput(early.toISOString())}T${toLocalTimeInput(early.toISOString())}:00`).toISOString()).toBe(early.toISOString())
  })
})
