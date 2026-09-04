import { MockResultClient } from '@/components/student/mock-result-client'
import { getStudentMockResult } from '@/lib/student-mocks'
import { requireServerAccessToken } from '@/lib/server-session'

export default async function MockResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const [{ attemptId }, token] = await Promise.all([params, requireServerAccessToken()])
  return <MockResultClient data={await getStudentMockResult(attemptId, token)} />
}
