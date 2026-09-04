import { MockAttemptClient } from '@/components/student/mock-attempt-client'
import { getStudentAttempt } from '@/lib/student-mocks'
import { requireServerAccessToken } from '@/lib/server-session'

export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const [{ attemptId }, token] = await Promise.all([params, requireServerAccessToken()])
  return <MockAttemptClient data={await getStudentAttempt(attemptId, token)} token={token} />
}
