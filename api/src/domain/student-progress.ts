type Course = { id: string; name: string }
type ClassSession = { id: string; course_id: string }
type Attendance = { live_class_id: string }
type Assignment = { id: string; course_id: string }
type Submission = { assignment_id: string }
type Mock = { id: string; course_id: string | null; title?: string }
type Attempt = {
  id: string; mock_exam_id: string; status: string; submitted_at?: string | null;
  total_score?: number | string | null; total_marks?: number | string | null;
  correct_mcq_answers?: number | null; total_mcq_questions?: number | null;
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round(part / total * 100) : null
}

export function buildStudentProgress(input: {
  courses: Course[]; classes: ClassSession[]; attendance: Attendance[];
  assignments: Assignment[]; submissions: Submission[]; mocks: Mock[]; attempts: Attempt[];
}) {
  const attended = new Set(input.attendance.map(item => item.live_class_id))
  const submitted = new Set(input.submissions.map(item => item.assignment_id))
  const completedAttempts = input.attempts.filter(item => item.status !== 'in_progress')
  const scored = completedAttempts.flatMap(attempt => {
    const score = Number(attempt.total_score)
    const marks = Number(attempt.total_marks)
    if (Number.isFinite(score) && Number.isFinite(marks) && marks > 0) return [score / marks * 100]
    if (attempt.total_mcq_questions && attempt.correct_mcq_answers != null) {
      return [attempt.correct_mcq_answers / attempt.total_mcq_questions * 100]
    }
    return []
  })
  const summarize = (courseId?: string) => {
    const classRows = input.classes.filter(item => !courseId || item.course_id === courseId)
    const assignmentRows = input.assignments.filter(item => !courseId || item.course_id === courseId)
    const mockIds = new Set(input.mocks.filter(item => !courseId || item.course_id === courseId).map(item => item.id))
    const attemptRows = completedAttempts.filter(item => mockIds.has(item.mock_exam_id))
    const percentages = attemptRows.flatMap(attempt => {
      const score = Number(attempt.total_score); const marks = Number(attempt.total_marks)
      if (Number.isFinite(score) && Number.isFinite(marks) && marks > 0) return [score / marks * 100]
      return attempt.total_mcq_questions && attempt.correct_mcq_answers != null
        ? [attempt.correct_mcq_answers / attempt.total_mcq_questions * 100] : []
    })
    return {
      classes_attended: classRows.filter(item => attended.has(item.id)).length,
      classes_held: classRows.length,
      attendance_percentage: percent(classRows.filter(item => attended.has(item.id)).length, classRows.length),
      assignments_submitted: assignmentRows.filter(item => submitted.has(item.id)).length,
      assignments_published: assignmentRows.length,
      assignment_completion_percentage: percent(assignmentRows.filter(item => submitted.has(item.id)).length, assignmentRows.length),
      mocks_completed: attemptRows.length,
      mock_average_percentage: percentages.length ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length) : null,
    }
  }
  const mocks = new Map(input.mocks.map(item => [item.id, item]))
  return {
    overall: { ...summarize(), mock_average_percentage: scored.length ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length) : null },
    courses: input.courses.map(course => ({ ...course, ...summarize(course.id) })),
    recent_mock_results: completedAttempts.filter(item => mocks.has(item.mock_exam_id))
      .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime())
      .slice(0, 5).map(attempt => ({
        attempt_id: attempt.id, mock_id: attempt.mock_exam_id,
        title: mocks.get(attempt.mock_exam_id)?.title || 'Mock exam', submitted_at: attempt.submitted_at,
        percentage: (() => { const score = Number(attempt.total_score); const marks = Number(attempt.total_marks); return Number.isFinite(score) && marks > 0 ? Math.round(score / marks * 100) : attempt.total_mcq_questions && attempt.correct_mcq_answers != null ? Math.round(attempt.correct_mcq_answers / attempt.total_mcq_questions * 100) : null })(),
      })),
  }
}
