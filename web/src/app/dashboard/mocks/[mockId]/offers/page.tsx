import { MockOffersManager } from '@/components/mock-access/mock-offers-manager'
import { requireServerAccessToken } from '@/lib/server-session'

export default async function MockOffersPage({ params }: { params: Promise<{ mockId: string }> }) {
  const [{ mockId }, token] = await Promise.all([params, requireServerAccessToken()])
  return <MockOffersManager mockId={mockId} token={token} />
}
