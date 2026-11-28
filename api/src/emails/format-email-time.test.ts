import { describe, expect, it } from 'vitest'
import { formatEmailDate, formatEmailDateTime, formatEmailDay, formatEmailTime, resolveAccountTimeZone, zoneName } from './format-email-time'

const fourPmLagos = '2026-12-01T15:00:00Z' // Tue 1 Dec, 4:00 PM in Lagos

describe('formatEmailTime (NTF-04, NTF-09)', () => {
  it('names the account zone', () => {
    expect(formatEmailTime(fourPmLagos, 'Africa/Lagos')).toBe('4:00 PM WAT')
  })

  it("adds the student's time when it differs", () => {
    expect(formatEmailTime(fourPmLagos, 'Africa/Lagos', 'Africa/Accra')).toBe('4:00 PM WAT (3:00 PM your time)')
  })

  it("leaves it out when the student's clock shows the same time", () => {
    expect(formatEmailTime(fourPmLagos, 'Africa/Lagos', 'Africa/Douala')).toBe('4:00 PM WAT')
    expect(formatEmailTime(fourPmLagos, 'Africa/Lagos', 'Africa/Lagos')).toBe('4:00 PM WAT')
  })

  it("names the student's day when it is a different day for them", () => {
    expect(formatEmailTime('2026-12-01T22:00:00Z', 'Africa/Lagos', 'Asia/Tokyo')).toBe('11:00 PM WAT (Wed 2 Dec, 7:00 AM your time)')
  })

  it('uses the names people use for African zones', () => {
    const at = new Date(fourPmLagos)
    expect(zoneName(at, 'Africa/Johannesburg')).toBe('SAST')
    expect(zoneName(at, 'Africa/Nairobi')).toBe('EAT')
    expect(zoneName(at, 'Africa/Accra')).toBe('GMT')
    expect(zoneName(at, 'Europe/London')).toBe('GMT')
    expect(zoneName(new Date('2026-07-01T12:00:00Z'), 'Europe/London')).toBe('BST')
    expect(zoneName(at, 'America/New_York')).toBe('EST')
  })

  it('falls back to the launch timezone for an unknown zone', () => {
    expect(formatEmailTime(fourPmLagos, 'Not/AZone')).toBe('4:00 PM WAT')
  })

  it('writes the date and time together', () => {
    expect(formatEmailDate(fourPmLagos, 'Africa/Lagos')).toBe('Tue 1 Dec')
    expect(formatEmailDateTime(fourPmLagos, 'Africa/Lagos')).toBe('Tue 1 Dec, 4:00 PM WAT')
  })

  it('works out today and tomorrow in the same zone as the time', () => {
    const now = new Date('2026-12-01T22:30:00Z') // 11:30 PM Tue in Lagos, 7:30 AM Wed in Tokyo
    expect(formatEmailDay('2026-12-01T22:45:00Z', 'Africa/Lagos', now)).toBe('today')
    expect(formatEmailDay('2026-12-02T09:00:00Z', 'Africa/Lagos', now)).toBe('tomorrow')
    expect(formatEmailDay('2026-12-02T09:00:00Z', 'Asia/Tokyo', now)).toBe('today')
    expect(formatEmailDay('2026-12-05T09:00:00Z', 'Africa/Lagos', now)).toBe('Sat 5 Dec')
  })

  it('uses Africa/Lagos while accounts have no timezone setting', async () => {
    await expect(resolveAccountTimeZone('school-1')).resolves.toBe('Africa/Lagos')
  })
})
