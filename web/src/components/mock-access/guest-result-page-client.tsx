'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getApiUrl } from '@/config/api'
import { authenticatedFetch } from '@/lib/authenticated-fetch'
import { loginHref } from '@/lib/auth-continuation'

export function GuestResultPageClient({ attemptId }: { attemptId: string }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const transfer = await authenticatedFetch(supabase, `${getApiUrl()}/guest/attempts/${attemptId}/transfer`, session.access_token, { method: 'POST', credentials: 'include' })
          const transferBody = await transfer.json().catch(() => null)
          if (transfer.ok) { window.location.assign(`/dashboard/student/mocks/result/${attemptId}`); return }
          if (![403, 409].includes(transfer.status)) throw new Error(transferBody?.error || 'Could not save this result to your account')
          if (!cancelled) setError(transferBody?.error || 'This result could not be moved to that account.')
        }
        const response = await fetch(`${getApiUrl()}/guest/attempts/${attemptId}/result`, { credentials: 'include', cache: 'no-store' })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error || 'Could not load this result')
        if (!cancelled) setData(body.data)
      } catch (loadError) { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load this result') }
    }
    void load()
    return () => { cancelled = true }
  }, [attemptId])

  if (!data) return <main className="flex min-h-screen items-center justify-center bg-[#f8f7f5] px-4"><div className="max-w-md text-center">{error ? <><h1 className="text-xl font-semibold">Result unavailable</h1><p className="mt-3 text-sm text-[#716c76]">{error}</p></> : <Loader2 className="mx-auto animate-spin text-[#2e2877]" />}</div></main>
  const score = Number(data.attempt.total_score || 0)
  const total = Number(data.attempt.total_marks || 0)
  const percentage = total > 0 ? Math.round(score / total * 100) : 0
  return <main className="min-h-screen bg-[#f8f7f5] px-4 py-12"><section className="mx-auto max-w-xl rounded-3xl border border-[#e2ddd8] bg-white p-7 text-center sm:p-10"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#994704]">Guest result</p><h1 className="mt-3 text-2xl font-semibold text-[#2e2877]">{data.mock.title}</h1><p className="mt-8 text-5xl font-semibold text-[#2e2877]">{percentage}%</p><p className="mt-2 text-sm text-[#716c76]">{score} out of {total} marks</p>{error && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}<div className="mt-8 rounded-2xl bg-[#fff7ed] p-5"><p className="text-sm leading-6 text-[#713f12]">Sign in to keep this result in your Kanvise account and access the full result view.</p><Link href={loginHref({ redirect: `/guest/result/${attemptId}`, flow: 'student' })} className="mt-4 inline-flex rounded-xl bg-[#994704] px-5 py-3 text-sm font-semibold text-white">Sign in and save result</Link></div><Link href="/" className="mt-6 inline-block text-sm font-medium text-[#2e2877]">Return to Kanvise</Link></section></main>
}
