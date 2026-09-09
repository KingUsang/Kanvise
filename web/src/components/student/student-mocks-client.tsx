'use client'

import Link from 'next/link'
import { BookOpen, Calculator, CheckCircle2, Clock3, PlayCircle, Search, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getApiUrl } from '@/config/api'
import type { StudentMockCard, StudentMockGroups, UnlockedMock } from '@/lib/student-mocks'

type Tab = keyof StudentMockGroups

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'available', label: 'Available' },
  { key: 'in_progress', label: 'Continue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
]

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : null
}

function Card({ item, state }: { item: StudentMockCard; state: Tab }) {
  const href = state === 'in_progress' && item.attempt ? `/dashboard/student/mocks/attempt/${item.attempt.id}`
    : state === 'completed' && item.attempt ? `/dashboard/student/mocks/result/${item.attempt.id}` : `/dashboard/student/mocks/${item.id}`
  const action = state === 'available' ? 'View instructions' : state === 'in_progress' ? 'Continue mock'
    : state === 'completed' ? 'View result' : 'View details'
  return <article className="flex h-full flex-col rounded-2xl border border-[#e4dfda] bg-white p-5 shadow-[0_1px_2px_rgba(35,31,38,0.04)]">
    <div className="flex items-start justify-between gap-3"><span className="rounded-full bg-[#f0edff] px-3 py-1 text-[11px] font-semibold text-[#2e2877]">{item.course?.name || 'Subject'}</span>{state === 'completed' && <CheckCircle2 size={19} className="text-[#29724b]" />}</div>
    <h2 className="mt-4 text-lg font-semibold leading-6 text-[#29262f]">{item.title}</h2>
    {item.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#716c76]">{item.description}</p>}
    <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-[#716c76]">
      <span className="flex items-center gap-1.5"><BookOpen size={14} />{item.version.total_questions} questions</span>
      <span className="flex items-center gap-1.5"><Clock3 size={14} />{item.time_limit_minutes ? `${item.time_limit_minutes} mins` : 'Untimed'}</span>
      {item.calculator_mode !== 'none' && <span className="flex items-center gap-1.5 capitalize"><Calculator size={14} />{item.calculator_mode}</span>}
      <span>{item.attempts_used}/{item.attempts_allowed} attempt{item.attempts_allowed === 1 ? '' : 's'}</span>
    </div>
    {state === 'upcoming' && item.available_from && <p className="mt-4 rounded-lg bg-[#f8f4ee] px-3 py-2 text-xs font-medium text-[#994704]">Opens {dateTime(item.available_from)}</p>}
    {state === 'in_progress' && item.attempt?.deadline_at && <p className="mt-4 rounded-lg bg-[#fff4e8] px-3 py-2 text-xs font-medium text-[#994704]">Your timer continues until {dateTime(item.attempt.deadline_at)}</p>}
    {state === 'completed' && item.attempt && <p className="mt-4 text-sm font-medium text-[#2e2877]">{item.attempt.total_score ?? '—'} / {item.attempt.total_marks ?? item.version.total_marks} marks</p>}
    <Link href={href} className={`mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 pt-3 text-sm font-semibold ${state === 'upcoming' ? 'border border-[#d9d3cf] text-[#2e2877]' : 'bg-[#2e2877] text-white hover:bg-[#211b68]'}`}><PlayCircle size={17} />{action}</Link>
  </article>
}

export function StudentMocksClient({ groups, unlocked, initialView }: { groups: StudentMockGroups; unlocked: UnlockedMock[]; initialView: 'programme' | 'unlocked' }) {
  const router = useRouter()
  const programmeCount = Object.values(groups).reduce((total, group) => total + group.length, 0)
  const [view, setView] = useState<'programme' | 'unlocked'>(initialView === 'programme' && !programmeCount && unlocked.length ? 'unlocked' : initialView)
  const initial = groups.in_progress.length ? 'in_progress' : groups.available.length ? 'available' : 'completed'
  const [tab, setTab] = useState<Tab>(initial)
  const [search, setSearch] = useState('')
  const [startingOfferId, setStartingOfferId] = useState<string | null>(null)
  const items = useMemo(() => groups[tab].filter(item => {
    const value = search.trim().toLowerCase()
    return !value || item.title.toLowerCase().includes(value) || item.course?.name?.toLowerCase().includes(value)
  }), [groups, search, tab])

  const unlockedItems = useMemo(() => unlocked.filter(item => {
    const value = search.trim().toLowerCase()
    const mock = item.offer?.mock
    return mock && (!value || mock.title.toLowerCase().includes(value) || mock.school?.name?.toLowerCase().includes(value))
  }), [search, unlocked])

  function changeView(next: 'programme' | 'unlocked') {
    setView(next)
    router.replace(`/dashboard/student/mocks${next === 'unlocked' ? '?view=unlocked' : ''}`, { scroll: false })
  }

  async function startUnlocked(item: UnlockedMock) {
    if (!item.offer) return
    setStartingOfferId(item.offer.id)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return router.push('/auth/login?redirect=%2Fdashboard%2Fstudent%2Fmocks%3Fview%3Dunlocked')
      const response = await fetch(`${getApiUrl()}/mock/${item.offer.id}/attempts`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not start this mock')
      router.push(`/attempt/${body.data.attempt_id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start this mock')
    } finally {
      setStartingOfferId(null)
    }
  }

  return <main className="mx-auto min-w-0 max-w-[1440px] px-4 py-7 pb-28 sm:px-6 lg:px-10 lg:py-10">
    <header><p className="text-sm font-medium text-[#994704]">Practice and assessment</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Mocks</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#716c76]">Programme assessments and mocks you unlocked are kept together here.</p></header>
    <div className="mt-6 grid w-full grid-cols-2 rounded-xl border border-[#ddd7d2] bg-white p-1 sm:inline-grid sm:w-auto" aria-label="Mock access source">
      <button type="button" onClick={() => changeView('programme')} className={`min-w-0 rounded-lg px-3 py-2 text-sm font-medium sm:px-4 ${view === 'programme' ? 'bg-[#2e2877] text-white' : 'text-[#716c76]'}`}>Programme <span className="ml-1 text-xs opacity-75">{programmeCount}</span></button>
      <button type="button" onClick={() => changeView('unlocked')} className={`rounded-lg px-4 py-2 text-sm font-medium ${view === 'unlocked' ? 'bg-[#2e2877] text-white' : 'text-[#716c76]'}`}>Unlocked <span className="ml-1 text-xs opacity-75">{unlocked.length}</span></button>
    </div>
    <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      {view === 'programme' ? <div className="-mx-4 flex overflow-x-auto px-4 pb-1 sm:mx-0 sm:rounded-xl sm:bg-[#eeeae6] sm:p-1">{tabs.map(item => <button key={item.key} onClick={() => setTab(item.key)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${tab === item.key ? 'bg-white text-[#2e2877] shadow-sm' : 'text-[#716c76]'}`}>{item.label}<span className="ml-2 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px]">{groups[item.key].length}</span></button>)}</div> : <p className="text-sm text-[#716c76]">Free and purchased mocks that belong to your account.</p>}
      <label className="relative block lg:w-80"><Search className="absolute left-3 top-3 text-[#8b858f]" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search mocks or subjects" className="w-full rounded-xl border border-[#ddd7d2] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#2e2877]" /></label>
    </div>
    {view === 'programme' ? (items.length ? <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => <Card key={`${tab}-${item.id}`} item={item} state={tab} />)}</section>
      : <section className="mt-6 rounded-2xl border border-[#e5e1dd] bg-white px-5 py-14 text-center">{search ? <SearchX className="mx-auto text-[#aaa4ad]" /> : <BookOpen className="mx-auto text-[#aaa4ad]" />}<h2 className="mt-4 text-lg font-semibold">{search ? 'No programme mocks match your search' : `No ${tabs.find(item => item.key === tab)?.label.toLowerCase()} programme mocks`}</h2><p className="mt-1 text-sm text-[#716c76]">{search ? 'Try a different mock title or subject.' : 'Mocks from your tutorial will appear here when they match this stage.'}</p></section>)
      : (unlockedItems.length ? <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{unlockedItems.map(item => { const offer = item.offer!; const mock = offer.mock; const exhausted = item.attempts_consumed >= item.attempts_granted; const expired = Boolean(item.expires_at && new Date(item.expires_at) <= new Date()); const currentAttempt = item.current_attempt; return <article key={item.id} className="flex h-full min-w-0 flex-col rounded-2xl border border-[#e4dfda] bg-white p-5 shadow-[0_1px_2px_rgba(35,31,38,0.04)]"><div className="flex min-w-0 items-start justify-between gap-3"><span className="shrink-0 rounded-full bg-[#fff4e8] px-3 py-1 text-[11px] font-semibold text-[#994704]">{offer.access_mode === 'paid' ? 'Purchased' : 'Free'}</span>{mock.school?.name && <span className="min-w-0 truncate text-xs text-[#716c76]">{mock.school.name}</span>}</div><h2 className="mt-4 break-words text-lg font-semibold leading-6 text-[#29262f]">{mock.title}</h2>{mock.description && <p className="mt-2 line-clamp-2 break-words text-sm leading-6 text-[#716c76]">{mock.description}</p>}<div className="mt-5 grid grid-cols-1 gap-3 text-xs text-[#716c76] min-[360px]:grid-cols-2"><span className="flex items-center gap-1.5"><BookOpen size={14} />{offer.version.total_questions} questions</span><span className="flex items-center gap-1.5"><Clock3 size={14} />{mock.time_limit_minutes ? `${mock.time_limit_minutes} mins` : 'Untimed'}</span>{mock.calculator_mode !== 'none' && <span className="flex items-center gap-1.5 capitalize"><Calculator size={14} />{mock.calculator_mode}</span>}<span>{item.attempts_consumed}/{item.attempts_granted} attempts used</span></div>{currentAttempt ? <Link href={`/attempt/${currentAttempt.id}`} className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2e2877] px-4 py-2.5 text-sm font-semibold text-white">{currentAttempt.deadline_at && new Date(currentAttempt.deadline_at) <= new Date() ? 'Finish expired attempt' : 'Continue mock'}</Link> : <button type="button" disabled={expired || exhausted || startingOfferId === offer.id} onClick={() => void startUnlocked(item)} className="mt-auto min-h-11 rounded-xl bg-[#2e2877] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{startingOfferId === offer.id ? 'Opening…' : expired ? 'Access expired' : exhausted ? 'Attempts used' : 'Start mock'}</button>}</article>})}</section>
        : <section className="mt-6 rounded-2xl border border-[#e5e1dd] bg-white px-5 py-14 text-center">{search ? <SearchX className="mx-auto text-[#aaa4ad]" /> : <BookOpen className="mx-auto text-[#aaa4ad]" />}<h2 className="mt-4 text-lg font-semibold">{search ? 'No unlocked mocks match your search' : 'No unlocked mocks yet'}</h2><p className="mt-1 text-sm text-[#716c76]">{search ? 'Try a different mock or tutorial name.' : 'Open a free mock link or complete a purchase and it will appear here.'}</p></section>)}
  </main>
}
