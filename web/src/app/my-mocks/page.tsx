import { MyMocksClient } from '@/components/mock-access/my-mocks-client'
import { getApiUrl } from '@/config/api'
import { requireServerAccessToken } from '@/lib/server-session'

export default async function MyMocksPage() {
  const token = await requireServerAccessToken(); const response = await fetch(`${getApiUrl()}/my-mocks`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || 'Could not load your mocks')
  return <MyMocksClient initial={body.data || []} />
}
