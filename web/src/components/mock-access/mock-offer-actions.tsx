'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getApiUrl } from '@/config/api'
import { authenticatedFetch } from '@/lib/authenticated-fetch'
import { loginHref } from '@/lib/auth-continuation'

type Props = {
  offerId: string
  mockId: string
  slug: string
  accessMode: string
  requiresSubjectSelection?: boolean
  subjectOptions?: string[]
}

export function MockOfferActions({
  offerId, mockId, slug, accessMode, requiresSubjectSelection = false, subjectOptions = [],
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showSubjectPicker, setShowSubjectPicker] = useState(false)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const redirect = `/mock/${encodeURIComponent(slug)}`

  function toggleSubject(subject: string) {
    setSelectedSubjects(current => current.includes(subject)
      ? current.filter(value => value !== subject)
      : [...current, subject])
  }

  async function startGuestAttempt(selectedSubjectNames: string[] = []) {
    setLoading(true)
    try {
      const response = await fetch(`${getApiUrl()}/guest/mock/${offerId}/attempts`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_subject_names: selectedSubjectNames }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.data?.attempt_id) throw new Error(body?.error || 'Could not start this mock')
      router.push(`/guest/attempt/${body.data.attempt_id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start this mock')
    } finally {
      setLoading(false)
    }
  }

  async function access() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      if (accessMode === 'free_claim') {
        if (requiresSubjectSelection) {
          if (!subjectOptions.length) {
            toast.error('The subjects for this mock are not ready yet. Please try again shortly.')
            return
          }
          setShowSubjectPicker(true)
          return
        }
        await startGuestAttempt()
        return
      }
      // A paid attempt needs an account before checkout and cannot fall back to a guest cookie.
      router.push(loginHref({ redirect, flow: 'student' }))
      return
    }

    setLoading(true)
    try {
      const profileResponse = await authenticatedFetch(supabase, `${getApiUrl()}/auth/me`)
      const profile = await profileResponse.json().catch(() => null)
      if (!profileResponse.ok) throw new Error(profile?.error || 'Could not verify your account')
      if (profile?.user?.role !== 'student') throw new Error('Please use a student account to attempt this mock.')

      if (profile.user.school_id) {
        const centrePreflight = await authenticatedFetch(supabase, `${getApiUrl()}/mocks/${mockId}/preflight`, { cache: 'no-store' })
        const centreBody = await centrePreflight.json().catch(() => null)
        if (centrePreflight.ok) {
          if (!centreBody.data.resumable_attempt && centreBody.data.attempts_used >= centreBody.data.attempts_allowed) {
            throw new Error('You have used all attempts included with this mock.')
          }
          const start = await authenticatedFetch(supabase, `${getApiUrl()}/mocks/${mockId}/attempts`, { method: 'POST' })
          const attempt = await start.json().catch(() => null)
          if (!start.ok) throw new Error(attempt?.error || 'Could not open this mock')
          router.push(`/dashboard/student/mocks/attempt/${attempt.data.attempt_id}`)
          return
        }
        if (centrePreflight.status !== 404) throw new Error(centreBody?.error || 'Could not check your programme access')
      }

      const preflight = await authenticatedFetch(supabase, `${getApiUrl()}/mock/${offerId}/preflight`, { cache: 'no-store' })
      const preflightBody = await preflight.json().catch(() => null)
      if (preflight.ok) {
        if (!preflightBody.data.resumable_attempt && preflightBody.data.attempts_used >= preflightBody.data.attempts_allowed) {
          throw new Error('You have used all attempts included with this mock.')
        }
        if (preflightBody?.data?.subject_combination?.subjects?.length) {
          toast.info('Choose the subjects you want to sit before starting your attempt.')
          router.push('/dashboard/student/mocks?view=unlocked')
          return
        }
        const start = await authenticatedFetch(supabase, `${getApiUrl()}/mock/${offerId}/attempts`, { method: 'POST' })
        const attempt = await start.json().catch(() => null)
        if (!start.ok) throw new Error(attempt?.error || 'Could not open this mock')
        router.push(`/dashboard/student/mocks/attempt/${attempt.data.attempt_id}`)
        return
      }
      if (preflight.status !== 403 || preflightBody?.code !== 'MOCK_ENTITLEMENT_NOT_FOUND') {
        throw new Error(preflightBody?.error || 'This mock is not available to your account')
      }

      if (accessMode === 'paid') {
        const response = await authenticatedFetch(supabase, `${getApiUrl()}/mock/${offerId}/checkout`, {
          method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() },
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error || 'Could not start checkout')
        window.location.assign(body.data.payment_url)
        return
      }
      const claim = await authenticatedFetch(supabase, `${getApiUrl()}/mock/${offerId}/claim`, { method: 'POST' })
      const body = await claim.json().catch(() => null)
      if (!claim.ok) throw new Error(body?.error || 'Could not unlock this mock')
      const claimedPreflight = await authenticatedFetch(supabase, `${getApiUrl()}/mock/${offerId}/preflight`, { cache: 'no-store' })
      const claimedPreflightBody = await claimedPreflight.json().catch(() => null)
      if (!claimedPreflight.ok) throw new Error(claimedPreflightBody?.error || 'Mock unlocked — open My Mocks to start')
      if (claimedPreflightBody?.data?.subject_combination?.subjects?.length) {
        toast.info('Choose the subjects you want to sit before starting your attempt.')
        router.push('/dashboard/student/mocks?view=unlocked')
        return
      }
      const start = await authenticatedFetch(supabase, `${getApiUrl()}/mock/${offerId}/attempts`, { method: 'POST' })
      const attempt = await start.json().catch(() => null)
      if (!start.ok) throw new Error(attempt?.error || 'Mock unlocked — open My Mocks to start')
      router.push(`/dashboard/student/mocks/attempt/${attempt.data.attempt_id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not continue')
    } finally {
      setLoading(false)
    }
  }

  const label = accessMode === 'paid'
    ? 'Buy and attempt mock'
    : loading ? 'Starting mock…' : requiresSubjectSelection ? 'Choose subjects and start' : 'Attempt mock'

  return <>
    <button type="button" onClick={() => void access()} disabled={loading} className="min-h-12 w-full rounded-xl bg-[#994704] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
      {loading && accessMode === 'paid' ? 'Opening secure checkout…' : label}
    </button>
    {showSubjectPicker && <div role="dialog" aria-modal="true" aria-labelledby="guest-subject-picker-title" className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-6">
      <section className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <p className="text-sm font-medium text-[#994704]">Choose your paper</p>
        <h2 id="guest-subject-picker-title" className="mt-1 text-2xl font-semibold text-[#29262f]">Which subjects are you sitting?</h2>
        <p className="mt-2 text-sm leading-6 text-[#716c76]">Choose one or more subjects. Only those questions will be included when this attempt starts.</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">{subjectOptions.map(subject => {
          const checked = selectedSubjects.includes(subject)
          return <label key={subject} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e4dfda] px-3 py-3 text-sm font-medium text-[#29262f]">
            <input type="checkbox" checked={checked} onChange={() => toggleSubject(subject)} className="h-4 w-4 accent-[#2e2877]" />{subject}
          </label>
        })}</div>
        <p className="mt-4 text-xs font-medium text-[#716c76]">{selectedSubjects.length} subject{selectedSubjects.length === 1 ? '' : 's'} selected</p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => setShowSubjectPicker(false)} disabled={loading} className="min-h-11 flex-1 rounded-xl border border-[#d9d3cf] px-4 text-sm font-semibold text-[#474551] disabled:opacity-50">Cancel</button>
          <button type="button" disabled={!selectedSubjects.length || loading} onClick={() => void startGuestAttempt(selectedSubjects)} className="min-h-11 flex-1 rounded-xl bg-[#994704] px-4 text-sm font-semibold text-white disabled:opacity-45">{loading ? 'Starting…' : 'Start selected subjects'}</button>
        </div>
      </section>
    </div>}
  </>
}
