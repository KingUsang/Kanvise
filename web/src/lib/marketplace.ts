import { getApiUrl } from '@/config/api'

export type MarketplaceListing = {
  id: string
  slug: string
  title: string
  short_description: string
  examination: string | null
  subjects: string[]
  tags: string[]
  difficulty: string | null
  duration_minutes: number | null
  question_count: number
  total_marks: number
  calculator_mode: 'none' | 'basic' | 'scientific'
  result_release_mode: string
  attempts_included: number
  pricing_type: 'free' | 'paid'
  price_kobo: number
  currency: 'NGN'
  available_from: string | null
  closes_at: string | null
  creator_school: { id: string; name: string } | null
  creator: { id: string; first_name: string; last_name: string } | null
  instructions?: string | null
}

async function publicApi<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiUrl()}${path}`, { cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'Could not load marketplace mocks')
  return body.data
}

export function getMarketplaceListings() {
  return publicApi<MarketplaceListing[]>('/marketplace/mocks')
}

export function getMarketplaceListing(slug: string) {
  return publicApi<MarketplaceListing>(`/marketplace/mocks/${encodeURIComponent(slug)}`)
}

export async function getMarketplacePreflight(listingId: string, accessToken: string) {
  const response = await fetch(`${getApiUrl()}/marketplace/mocks/${listingId}/preflight`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'Could not load mock instructions')
  return body.data
}

export async function getMarketplacePurchases(accessToken: string) {
  const response = await fetch(`${getApiUrl()}/students/me/purchases`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'Could not load purchases')
  return body.data as Array<{ id: string; paystack_reference: string; mock_price_kobo: number; student_processing_fee_kobo: number; total_charged_kobo: number; currency: string; status: string; created_at: string; paid_at: string | null; listing: { title: string; slug: string } | null }>
}
