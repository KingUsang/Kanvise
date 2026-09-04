'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getApiUrl } from '@/config/api'

export function MockOfferActions({ offerId, slug, accessMode }: { offerId: string; slug: string; accessMode: string }) {
  const router = useRouter(); const [loading, setLoading] = useState(false)
  const redirect = `/mock/${encodeURIComponent(slug)}`
  async function access() {
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) { router.push(`/auth/login?redirect=${encodeURIComponent(redirect)}`); return }
    setLoading(true)
    try {
      if (accessMode === 'paid') {
        const response = await fetch(`${getApiUrl()}/mock/${offerId}/checkout`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Idempotency-Key': crypto.randomUUID() } })
        const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || 'Could not start checkout')
        window.location.assign(body.data.payment_url); return
      }
      const claim = await fetch(`${getApiUrl()}/mock/${offerId}/claim`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
      const body = await claim.json().catch(() => null); if (!claim.ok) throw new Error(body?.error || 'Could not unlock this mock')
      const start = await fetch(`${getApiUrl()}/mock/${offerId}/attempts`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
      const attempt = await start.json().catch(() => null); if (!start.ok) throw new Error(attempt?.error || 'Mock unlocked — open My Mocks to start')
      router.push(`/attempt/${attempt.data.attempt_id}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not continue') } finally { setLoading(false) }
  }
  const label = accessMode === 'paid' ? 'Buy and attempt mock' : loading ? 'Unlocking mock…' : 'Attempt mock'
  return <button onClick={() => void access()} disabled={loading} className="min-h-12 w-full rounded-xl bg-[#994704] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading && accessMode === 'paid' ? 'Opening secure checkout…' : label}</button>
}
