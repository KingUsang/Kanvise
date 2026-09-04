import { StudentProgressClient } from '@/components/student/student-progress-client'
import { getStudentProgress } from '@/lib/student-progress'
import { requireServerAccessToken } from '@/lib/server-session'

export default async function StudentProgressPage() {
  const token = await requireServerAccessToken()
  return <StudentProgressClient progress={await getStudentProgress(token)} />
}
