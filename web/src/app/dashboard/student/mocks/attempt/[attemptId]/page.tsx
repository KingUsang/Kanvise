import { MockAttemptClient } from '@/components/student/mock-attempt-client'
import { getStudentAttempt } from '@/lib/student-mocks'
import { requireServerAccessToken } from '@/lib/server-session'
import { serverAccountContextHeaders, withAccountPicker } from '@/lib/server/server-account'

export default async function MockAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const [{ attemptId }, token, accountHeaders] = await Promise.all([params, requireServerAccessToken(), serverAccountContextHeaders()])
  const data = await withAccountPicker(() => getStudentAttempt(attemptId, token, accountHeaders), `/dashboard/student/mocks/attempt/${encodeURIComponent(attemptId)}`)
  return <MockAttemptClient data={data} />
}
