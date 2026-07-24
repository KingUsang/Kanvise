'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getApiUrl } from '@/config/api'

export function MarketplaceListingActions({ listingId, free }: { listingId: string; free: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const redirect = '/mocks'
  async function claim() {
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) { router.push(`/auth/login?redirect=${encodeURIComponent(redirect)}`); return }
    setLoading(true)
    try {
      const response = await fetch(`${getApiUrl()}/marketplace/mocks/${listingId}/claim`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not claim this mock')
      toast.success(body.data?.newly_claimed ? 'Mock added to your library' : 'This mock is already in your library')
      router.push(`/dashboard/student/mocks/marketplace/${listingId}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not claim this mock') }
    finally { setLoading(false) }
  }
  async function checkout() {
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) { router.push(`/auth/login?redirect=${encodeURIComponent(redirect)}`); return }
    setLoading(true)
    try {
      const response = await fetch(`${getApiUrl()}/marketplace/mocks/${listingId}/checkout`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Idempotency-Key': crypto.randomUUID() } })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not start checkout')
      window.location.assign(body.data.payment_url)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not start checkout') }
    finally { setLoading(false) }
  }
  return <button onClick={() => void (free ? claim() : checkout())} disabled={loading} className="min-h-12 w-full rounded-xl bg-[#994704] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? (free ? 'Adding to your mocks…' : 'Opening secure checkout…') : free ? 'Get this mock free' : 'Buy this mock'}</button>
}
