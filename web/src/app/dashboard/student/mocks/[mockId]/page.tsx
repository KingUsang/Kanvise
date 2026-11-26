import { MockPreflightClient } from '@/components/student/mock-preflight-client'
import { getMockPreflight } from '@/lib/student-mocks'
import { requireServerAccessToken } from '@/lib/server-session'
import { serverAccountContextHeaders, withAccountPicker } from '@/lib/server/server-account'

export default async function MockPreflightPage({ params }: { params: Promise<{ mockId: string }> }) {
  const [{ mockId }, token, accountHeaders] = await Promise.all([params, requireServerAccessToken(), serverAccountContextHeaders()])
  const data = await withAccountPicker(() => getMockPreflight(mockId, token, accountHeaders), `/dashboard/student/mocks/${encodeURIComponent(mockId)}`)
  return <MockPreflightClient data={data} />
}
