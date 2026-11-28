import { describe, expect, it } from 'vitest'
import { lessonDisplayStatus } from './dashboard-overview'
import { weekPeriods } from './reporting-period'

const lesson = (status: string, at = '2026-11-27T10:00:00Z') => ({ status, scheduled_at: at, duration_minutes: 60 })

describe('lessonDisplayStatus (DB-03 chips)', () => {
  const at = (time: string) => new Date(`2026-11-27T${time}Z`)

  it('is Planned until the classroom opens, then Starting soon', () => {
    expect(lessonDisplayStatus(lesson('scheduled'), at('09:00:00'))).toBe('planned')
    expect(lessonDisplayStatus(lesson('scheduled'), at('09:44:59'))).toBe('planned')
    expect(lessonDisplayStatus(lesson('scheduled'), at('09:45:00'))).toBe('starting-soon')
  })

  it('uses the account setting instead of a fixed number of minutes', () => {
    expect(lessonDisplayStatus(lesson('scheduled'), at('09:45:00'), 5)).toBe('planned')
    expect(lessonDisplayStatus(lesson('scheduled'), at('09:30:00'), 30)).toBe('starting-soon')
  })

  it('is Not held when the scheduled end passed without a start', () => {
    expect(lessonDisplayStatus(lesson('scheduled'), at('11:00:00'))).toBe('not-held')
  })

  it('maps stored lifecycle states', () => {
    expect(lessonDisplayStatus(lesson('live'), at('10:10:00'))).toBe('live')
    expect(lessonDisplayStatus(lesson('ending'), at('10:10:00'))).toBe('live')
    expect(lessonDisplayStatus(lesson('ready'), at('09:50:00'))).toBe('starting-soon')
    expect(lessonDisplayStatus(lesson('completed'), at('12:00:00'))).toBe('complete')
    expect(lessonDisplayStatus(lesson('cancelled'), at('09:00:00'))).toBe('cancelled')
  })
})

describe('weekPeriods (DB-04)', () => {
  it('runs Monday to Sunday in the account zone', () => {
    // Friday 27 Nov 2026, Lagos (UTC+1).
    const week = weekPeriods(new Date('2026-11-27T12:00:00Z'), 'Africa/Lagos')
    expect(week.days.map((day) => day.date)).toEqual([
      '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29',
    ])
    expect(week.todayIndex).toBe(4)
    expect(week.weekStart.toISOString()).toBe('2026-11-22T23:00:00.000Z')
    expect(week.weekEnd.toISOString()).toBe('2026-11-29T22:59:59.999Z')
  })

  it('treats Sunday as the last day and moves by whole weeks', () => {
    const sunday = weekPeriods(new Date('2026-11-29T12:00:00Z'), 'Africa/Lagos')
    expect(sunday.todayIndex).toBe(6)
    const next = weekPeriods(new Date('2026-11-29T12:00:00Z'), 'Africa/Lagos', 1)
    expect(next.days[0].date).toBe('2026-11-30')
    expect(next.todayIndex).toBe(-1)
    expect(weekPeriods(new Date('2026-11-29T12:00:00Z'), 'Africa/Lagos', -1).days[0].date).toBe('2026-11-16')
  })

  it('uses the local day, not the UTC day, near midnight', () => {
    // 23:30 UTC Sunday is already Monday 00:30 in Lagos.
    const week = weekPeriods(new Date('2026-11-29T23:30:00Z'), 'Africa/Lagos')
    expect(week.days[0].date).toBe('2026-11-30')
    expect(week.todayIndex).toBe(0)
  })
})
