'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getApiUrl } from '@/config/api'
import { authenticatedFetch } from '@/lib/authenticated-fetch'
import { loginHref } from '@/lib/auth-continuation'

export function MockOfferActions({ offerId, slug, accessMode }: { offerId: string; slug: string; accessMode: string }) {
  const router = useRouter(); const [loading, setLoading] = useState(false)
  const redirect = `/mock/${encodeURIComponent(slug)}`
  async function access() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      if (accessMode === 'free_claim') {
        setLoading(true)
        try {
          const response = await fetch(`${getApiUrl()}/guest/mock/${offerId}/attempts`, { method: 'POST', credentials: 'include' })
          const body = await response.json().catch(() => null)
          if (!response.ok || !body?.data?.attempt_id) throw new Error(body?.error || 'Could not start this mock')
          router.push(`/guest/attempt/${body.data.attempt_id}`)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Could not start this mock')
        } finally { setLoading(false) }
        return
      }
      router.push(loginHref({ redirect, flow: 'student' })); return
    }
    setLoading(true)
    try {
      const profileResponse = await authenticatedFetch(supabase, `${getApiUrl()}/auth/me`, session.access_token)
      const profile = await profileResponse.json().catch(() => null)
      if (!profileResponse.ok) throw new Error(profile?.error || 'Could not verify your account')
      if (profile?.user?.role !== 'student') throw new Error('Please use a student account to attempt this mock.')

      const preflight = await authenticatedFetch(supabase, `${getApiUrl()}/mock/${offerId}/preflight`, session.access_token, { cache: 'no-store' })
      const preflightBody = await preflight.json().catch(() => null)
      if (preflight.ok) {
        if (!preflightBody.data.resumable_attempt && preflightBody.data.attempts_used >= preflightBody.data.attempts_allowed) {
          throw new Error('You have used all attempts included with this mock.')
        }
        const start = await authenticatedFetch(supabase, `${getApiUrl()}/mock/${offerId}/attempts`, session.access_token, { method: 'POST' })
        const attempt = await start.json().catch(() => null)
        if (!start.ok) throw new Error(attempt?.error || 'Could not open this mock')
        router.push(`/attempt/${attempt.data.attempt_id}`)
        return
      }
      if (preflight.status !== 403 || preflightBody?.code !== 'MOCK_ENTITLEMENT_NOT_FOUND') {
        throw new Error(preflightBody?.error || 'This mock is not available to your account')
      }

      if (accessMode === 'paid') {
        const response = await authenticatedFetch(supabase, `${getApiUrl()}/mock/${offerId}/checkout`, session.access_token, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } })
        const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || 'Could not start checkout')
        window.location.assign(body.data.payment_url); return
      }
      const claim = await authenticatedFetch(supabase, `${getApiUrl()}/mock/${offerId}/claim`, session.access_token, { method: 'POST' })
      const body = await claim.json().catch(() => null); if (!claim.ok) throw new Error(body?.error || 'Could not unlock this mock')
      const start = await authenticatedFetch(supabase, `${getApiUrl()}/mock/${offerId}/attempts`, session.access_token, { method: 'POST' })
      const attempt = await start.json().catch(() => null); if (!start.ok) throw new Error(attempt?.error || 'Mock unlocked — open My Mocks to start')
      router.push(`/attempt/${attempt.data.attempt_id}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not continue') } finally { setLoading(false) }
  }
  const label = accessMode === 'paid' ? 'Buy and attempt mock' : loading ? 'Unlocking mock…' : 'Attempt mock'
  return <button onClick={() => void access()} disabled={loading} className="min-h-12 w-full rounded-xl bg-[#994704] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading && accessMode === 'paid' ? 'Opening secure checkout…' : label}</button>
}
