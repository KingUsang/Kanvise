'use client'

import { Calculator, CheckCircle2, ChevronLeft, Clock3, FileQuestion, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { getApiUrl } from '@/config/api'
import { startNavigationProgress } from '@/components/navigation/NavigationProgress'

type PreflightData = {
  mock: { id: string; title: string; description?: string | null; course?: { name: string } | null; time_limit_minutes: number; calculator_mode: string }
  version: { total_questions: number }
  availability: 'open' | 'upcoming' | 'closed'
  attempts_used: number
  attempts_allowed: number
  resumable_attempt: { id: string } | null
}

export function MockPreflightClient({ data, token }: { data: PreflightData; token: string }) {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)
  const [starting, setStarting] = useState(false)
  const mock = data.mock
  const canStart = data.availability === 'open' && data.attempts_used < data.attempts_allowed

  async function start() {
    if (data.resumable_attempt) {
      startNavigationProgress(); router.push(`/dashboard/student/mocks/attempt/${data.resumable_attempt.id}`); return
    }
    if (!accepted) return toast.error('Confirm that you are ready before starting.')
    setStarting(true)
    try {
      const response = await fetch(`${getApiUrl()}/mocks/${mock.id}/attempts`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not start this mock')
      startNavigationProgress(); router.push(`/dashboard/student/mocks/attempt/${body.data.attempt_id}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not start this mock') }
    finally { setStarting(false) }
  }

  return <main className="mx-auto max-w-4xl px-4 py-7 pb-24 sm:px-6 lg:py-10">
    <Link href="/dashboard/student/mocks" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2e2877]"><ChevronLeft size={17} />Back to mocks</Link>
    <section className="mt-5 overflow-hidden rounded-3xl border border-[#e3ded9] bg-white">
      <header className="bg-[#2e2877] px-6 py-7 text-white sm:px-9 sm:py-9"><p className="text-sm text-white/70">{mock.course?.name || 'Course'}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{mock.title}</h1>{mock.description && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-white/75">{mock.description}</p>}</header>
      <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_280px]">
        <div><h2 className="text-xl font-semibold">Before you begin</h2><div className="mt-5 space-y-4 text-sm leading-6 text-[#5f5964]">
          <p className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-[#29724b]" size={20} /><span>Your timer is controlled by the server. Closing or refreshing the page will not pause it.</span></p>
          <p className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-[#29724b]" size={20} /><span>Your answers save as you work. Check the save status before moving away from a question.</span></p>
          <p className="flex gap-3"><FileQuestion className="mt-0.5 shrink-0 text-[#29724b]" size={20} /><span>You can flag questions, review unanswered ones, and submit when you are ready.</span></p>
        </div>
        {!data.resumable_attempt && canStart && <label className="mt-7 flex cursor-pointer items-start gap-3 rounded-xl bg-[#f7f4f1] p-4 text-sm"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[#2e2877]" /><span>I understand that starting begins my attempt and timer.</span></label>}</div>
        <aside className="rounded-2xl bg-[#f7f4f1] p-5"><h2 className="font-semibold">Mock details</h2><dl className="mt-4 space-y-4 text-sm"><div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-[#716c76]"><FileQuestion size={16} />Questions</dt><dd className="font-semibold">{data.version.total_questions}</dd></div><div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-[#716c76]"><Clock3 size={16} />Time</dt><dd className="font-semibold">{mock.time_limit_minutes ? `${mock.time_limit_minutes} mins` : 'Untimed'}</dd></div><div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-[#716c76]"><Calculator size={16} />Calculator</dt><dd className="font-semibold capitalize">{mock.calculator_mode}</dd></div><div className="flex items-center justify-between gap-3"><dt className="text-[#716c76]">Attempts</dt><dd className="font-semibold">{data.attempts_used} of {data.attempts_allowed} used</dd></div></dl>
          {data.availability === 'upcoming' && <p className="mt-5 rounded-lg bg-[#fff4e8] p-3 text-xs font-medium text-[#994704]">This mock has not opened yet.</p>}
          {data.availability === 'closed' && <p className="mt-5 rounded-lg bg-[#fdeae7] p-3 text-xs font-medium text-[#9b2f20]">This mock has closed.</p>}
          <button onClick={start} disabled={starting || (!data.resumable_attempt && (!canStart || !accepted))} className="mt-5 min-h-12 w-full rounded-xl bg-[#994704] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{starting ? 'Starting…' : data.resumable_attempt ? 'Continue attempt' : 'Start mock'}</button>
        </aside>
      </div>
    </section>
  </main>
}
