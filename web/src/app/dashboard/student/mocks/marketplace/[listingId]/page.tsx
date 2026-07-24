import { MockPreflightClient } from '@/components/student/mock-preflight-client'
import { getMarketplacePreflight } from '@/lib/marketplace'
import { requireServerAccessToken } from '@/lib/server-session'

export default async function MarketplaceMockPreflightPage({ params }: { params: Promise<{ listingId: string }> }) {
  const [{ listingId }, token] = await Promise.all([params, requireServerAccessToken()])
  return <MockPreflightClient data={await getMarketplacePreflight(listingId, token)} token={token} startPath={`/marketplace/mocks/${listingId}/attempts`} backHref="/mocks" />
}
