import { MockPreflightClient } from '@/components/student/mock-preflight-client'
import { getMockPreflight } from '@/lib/student-mocks'
import { requireServerAccessToken } from '@/lib/server-session'

export default async function MockPreflightPage({ params }: { params: Promise<{ mockId: string }> }) {
  const [{ mockId }, token] = await Promise.all([params, requireServerAccessToken()])
  return <MockPreflightClient data={await getMockPreflight(mockId, token)} token={token} />
}
