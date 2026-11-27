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

describe('buildStudentProgress attempt set', () => {
  it('counts duplicated attempts once and ignores attempts on Quizzes the Learner cannot see', () => {
    const attempt = { id: 'a1', mock_exam_id: 'm1', status: 'completed', total_score: 5, total_marks: 10, submitted_at: '2026-01-01T00:00:00Z' }
    const hidden = { id: 'a2', mock_exam_id: 'hidden', status: 'completed', total_score: 0, total_marks: 10, submitted_at: '2026-01-02T00:00:00Z' }
    const result = buildStudentProgress({
      courses: [{ id: 'c1', name: 'Maths' }], classes: [], attendance: [], assignments: [], submissions: [],
      mocks: [{ id: 'm1', course_id: 'c1', title: 'Quiz' }], attempts: [attempt, { ...attempt }, hidden],
    })
    expect(result.overall.mocks_completed).toBe(1)
    expect(result.overall.mock_average_percentage).toBe(50)
    expect(result.recent_mock_results).toHaveLength(1)
  })
})
