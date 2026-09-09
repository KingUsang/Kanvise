'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getApiUrl } from '@/config/api'
import { authenticatedFetch } from '@/lib/authenticated-fetch'
import { MockAttemptClient } from '@/components/student/mock-attempt-client'

export function GuestAttemptPageClient({ attemptId }: { attemptId: string }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const transfer = await authenticatedFetch(supabase, `${getApiUrl()}/guest/attempts/${attemptId}/transfer`, session.access_token, {
            method: 'POST', credentials: 'include',
          })
          const transferBody = await transfer.json().catch(() => null)
          if (transfer.ok) {
            window.location.assign(`/attempt/${attemptId}`)
            return
          }
          if (![403, 409].includes(transfer.status)) throw new Error(transferBody?.error || 'Could not save guest progress to your account')
          if (!cancelled) setError(transferBody?.error || 'Continue this guest attempt before moving it to your account.')
        }
        const response = await fetch(`${getApiUrl()}/guest/attempts/${attemptId}`, { credentials: 'include', cache: 'no-store' })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error || 'Could not load this guest attempt')
        if (!cancelled) setData({ ...body.data, server_now: body.server_now })
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load this guest attempt')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [attemptId])

  if (!data) return <main className="flex min-h-screen items-center justify-center bg-[#f8f7f5] px-4"><div className="max-w-md text-center">{error ? <><h1 className="text-xl font-semibold">Guest attempt unavailable</h1><p className="mt-3 text-sm text-[#716c76]">{error}</p></> : <><Loader2 className="mx-auto animate-spin text-[#2e2877]" /><p className="mt-3 text-sm text-[#716c76]">Loading your saved attempt…</p></>}</div></main>
  return <>{error && <div role="alert" className="bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">{error}</div>}<MockAttemptClient data={data} guest /></>
}
