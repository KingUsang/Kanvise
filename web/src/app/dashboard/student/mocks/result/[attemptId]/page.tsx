import { MockResultClient } from '@/components/student/mock-result-client'
import { getStudentMockResult } from '@/lib/student-mocks'
import { requireServerAccessToken } from '@/lib/server-session'
import { serverAccountContextHeaders, withAccountPicker } from '@/lib/server/server-account'

export default async function MockResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const [{ attemptId }, token, accountHeaders] = await Promise.all([params, requireServerAccessToken(), serverAccountContextHeaders()])
  const data = await withAccountPicker(() => getStudentMockResult(attemptId, token, accountHeaders), `/dashboard/student/mocks/result/${encodeURIComponent(attemptId)}`)
  return <MockResultClient data={data} />
}
