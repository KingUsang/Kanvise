import { afterEach, describe, expect, it } from 'vitest'
import { isValidTimezone, reportingPeriods, resolveReportingTimezone } from './reporting-period'

describe('reporting periods (DEV-DSH-004)', () => {
  afterEach(() => { delete process.env.DASHBOARD_REPORTING_TIMEZONE })

  it('computes Lagos day and month boundaries regardless of the host zone', () => {
    // 23:30 UTC on 30 Nov is already 1 Dec 00:30 in Lagos (UTC+1).
    const p = reportingPeriods(new Date('2026-11-30T23:30:00Z'), 'Africa/Lagos')
    expect(p.todayStart.toISOString()).toBe('2026-11-30T23:00:00.000Z')
    expect(p.todayEnd.toISOString()).toBe('2026-12-01T22:59:59.999Z')
    expect(p.monthStart.toISOString()).toBe('2026-11-30T23:00:00.000Z')
    expect(p.sevenDayEnd.toISOString()).toBe('2026-12-08T22:59:59.999Z')
  })

  it('keeps the same instant on the previous local day for zones behind UTC', () => {
    const p = reportingPeriods(new Date('2026-12-01T03:00:00Z'), 'America/New_York')
    expect(p.todayStart.toISOString()).toBe('2026-11-30T05:00:00.000Z')
    expect(p.monthStart.toISOString()).toBe('2026-11-01T04:00:00.000Z')
  })

  it('handles a daylight saving transition day', () => {
    // New York springs forward on 2027-03-14; that local day is 23 hours long.
    const p = reportingPeriods(new Date('2027-03-14T15:00:00Z'), 'America/New_York')
    expect(p.todayStart.toISOString()).toBe('2027-03-14T05:00:00.000Z')
    expect(p.todayEnd.toISOString()).toBe('2027-03-15T03:59:59.999Z')
  })

  it('validates and resolves the timezone', () => {
    expect(isValidTimezone('Africa/Lagos')).toBe(true)
    expect(isValidTimezone('Not/AZone')).toBe(false)
    expect(resolveReportingTimezone('bogus')).toBe('Africa/Lagos')
    process.env.DASHBOARD_REPORTING_TIMEZONE = 'Europe/London'
    expect(resolveReportingTimezone(undefined)).toBe('Europe/London')
    expect(resolveReportingTimezone('Asia/Tokyo')).toBe('Asia/Tokyo')
  })
})
