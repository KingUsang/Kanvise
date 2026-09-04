import { describe, expect, it } from 'vitest'
import { buildStudentProgress } from './student-progress'

describe('student progress summaries', () => {
  it('calculates only from recorded activity and keeps missing metrics null', () => {
    const result = buildStudentProgress({
      courses: [{ id: 'maths', name: 'Mathematics' }],
      classes: [{ id: 'class-1', course_id: 'maths' }, { id: 'class-2', course_id: 'maths' }],
      attendance: [{ live_class_id: 'class-1' }],
      assignments: [{ id: 'assignment-1', course_id: 'maths' }], submissions: [],
      mocks: [], attempts: [],
    })
    expect(result.overall.attendance_percentage).toBe(50)
    expect(result.overall.assignment_completion_percentage).toBe(0)
    expect(result.overall.mock_average_percentage).toBeNull()
  })

  it('uses immutable mock totals for comparable percentages', () => {
    const result = buildStudentProgress({
      courses: [{ id: 'maths', name: 'Mathematics' }], classes: [], attendance: [], assignments: [], submissions: [],
      mocks: [{ id: 'mock-1', course_id: 'maths', title: 'Practice' }],
      attempts: [{ id: 'attempt-1', mock_exam_id: 'mock-1', status: 'submitted', total_score: 15, total_marks: 20, submitted_at: '2026-07-23' }],
    })
    expect(result.overall.mock_average_percentage).toBe(75)
    expect(result.recent_mock_results[0].percentage).toBe(75)
  })
})
