'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getApiUrl } from '@/config/api'

export function MyMocksClient({ initial }: { initial: any[] }) {
  const router = useRouter(); const [loading, setLoading] = useState<string | null>(null)
  async function start(offer: any) {
    const { data: { session } } = await createClient().auth.getSession(); if (!session) { router.push('/auth/login?redirect=%2Fmy-mocks'); return }
    setLoading(offer.id)
    try {
      const response = await fetch(`${getApiUrl()}/mock/${offer.id}/attempts`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
      const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || 'Could not start this mock')
      router.push(`/attempt/${body.data.attempt_id}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not start this mock') } finally { setLoading(null) }
  }
  return <main className="mx-auto max-w-5xl px-4 py-10 pb-24 sm:px-6"><header><p className="text-sm font-semibold text-[#994704]">Your practice library</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">My mocks</h1><p className="mt-2 text-sm leading-6 text-[#716c76]">Mocks you have unlocked stay here, whether or not you are enrolled in a programme.</p></header>{initial.length ? <section className="mt-7 grid gap-4 sm:grid-cols-2">{initial.map(item => { const offer = item.offer; const mock = offer?.mock; if (!offer || !mock) return null; const exhausted = item.attempts_consumed >= item.attempts_granted; return <article key={item.id} className="rounded-2xl border border-[#e3ded9] bg-white p-5"><p className="text-xs font-semibold text-[#994704]">{offer.access_mode === 'paid' ? 'Purchased mock' : 'Unlocked mock'}</p><h2 className="mt-2 text-lg font-semibold">{mock.title}</h2><p className="mt-2 text-sm text-[#716c76]">{offer.version?.total_questions || '—'} questions · {item.attempts_consumed}/{item.attempts_granted} attempts used</p><button disabled={exhausted || loading === offer.id} onClick={() => void start(offer)} className="mt-5 min-h-11 w-full rounded-xl bg-[#2e2877] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading === offer.id ? 'Starting…' : exhausted ? 'Attempts used' : 'Start mock'}</button></article> })}</section> : <section className="mt-7 rounded-2xl border border-[#e3ded9] bg-white p-10 text-center"><h2 className="text-lg font-semibold">No unlocked mocks yet</h2><p className="mt-2 text-sm text-[#716c76]">When someone shares a mock link with you and you unlock it, it will appear here.</p></section>}</main>
}
