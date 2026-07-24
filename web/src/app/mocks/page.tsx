import { MarketplaceBrowser } from '@/components/marketplace/marketplace-browser'
import { getMarketplaceListings } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export default async function MarketplacePage() {
  return <MarketplaceBrowser listings={await getMarketplaceListings()} />
}
