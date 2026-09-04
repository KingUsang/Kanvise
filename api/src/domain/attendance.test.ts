import { describe, expect, it } from 'vitest'
import { summariseStudentEvents, uniqueAttendancePairCount } from './attendance'

describe('attendance calculations', () => {
  it('counts a reconnect as one student-class attendance', () => {
    expect(uniqueAttendancePairCount([
      { student_id: 'student-1', live_class_id: 'class-1' },
      { student_id: 'student-1', live_class_id: 'class-1' },
      { student_id: 'student-1', live_class_id: 'class-2' },
    ])).toBe(2)
  })

  it('uses the first arrival and sums time across reconnects', () => {
    const summary = summariseStudentEvents([
      {
        student_id: 'student-1',
        live_class_id: 'class-1',
        joined_at: '2026-07-23T10:15:00.000Z',
        duration_seconds: 600,
      },
      {
        student_id: 'student-1',
        live_class_id: 'class-1',
        joined_at: '2026-07-23T10:00:00.000Z',
        duration_seconds: 1200,
      },
    ])

    expect(summary?.earliest.joined_at).toBe('2026-07-23T10:00:00.000Z')
    expect(summary?.totalDurationSeconds).toBe(1800)
  })
})
