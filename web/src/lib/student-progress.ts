import { getApiUrl } from '@/config/api'

export type ProgressMetrics = {
  classes_attended: number; classes_held: number; attendance_percentage: number | null;
  assignments_submitted: number; assignments_published: number; assignment_completion_percentage: number | null;
  mocks_completed: number; mock_average_percentage: number | null;
}
export type StudentProgress = {
  overall: ProgressMetrics
  courses: Array<ProgressMetrics & { id: string; name: string }>
  recent_mock_results: Array<{ attempt_id: string; mock_id: string; title: string; submitted_at: string; percentage: number | null }>
}

export async function getStudentProgress(accessToken: string): Promise<StudentProgress> {
  const response = await fetch(`${getApiUrl()}/dashboard/student/progress`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'Could not load your progress')
  return body.data
}
