'use client'

import Link from 'next/link'
import { BookOpen, Calculator, CheckCircle2, Clock3, PlayCircle, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { StudentMockCard, StudentMockGroups } from '@/lib/student-mocks'

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

export function StudentMocksClient({ groups }: { groups: StudentMockGroups }) {
  const initial = groups.in_progress.length ? 'in_progress' : groups.available.length ? 'available' : 'completed'
  const [tab, setTab] = useState<Tab>(initial)
  const [search, setSearch] = useState('')
  const items = useMemo(() => groups[tab].filter(item => {
    const value = search.trim().toLowerCase()
    return !value || item.title.toLowerCase().includes(value) || item.course?.name?.toLowerCase().includes(value)
  }), [groups, search, tab])

  return <main className="mx-auto max-w-[1440px] px-4 py-7 pb-24 sm:px-6 lg:px-10 lg:py-10">
    <header><p className="text-sm font-medium text-[#994704]">Practice and assessment</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Mock exams</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#716c76]">Take mocks shared by your tutors, continue where you stopped, and review released results.</p></header>
    <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex overflow-x-auto rounded-xl bg-[#eeeae6] p-1">{tabs.map(item => <button key={item.key} onClick={() => setTab(item.key)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${tab === item.key ? 'bg-white text-[#2e2877] shadow-sm' : 'text-[#716c76]'}`}>{item.label}<span className="ml-2 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px]">{groups[item.key].length}</span></button>)}</div>
      <label className="relative block lg:w-80"><Search className="absolute left-3 top-3 text-[#8b858f]" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search mocks or subjects" className="w-full rounded-xl border border-[#ddd7d2] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#2e2877]" /></label>
    </div>
    {items.length ? <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => <Card key={`${tab}-${item.id}`} item={item} state={tab} />)}</section>
      : <section className="mt-6 rounded-2xl border border-[#e5e1dd] bg-white px-5 py-14 text-center"><BookOpen className="mx-auto text-[#aaa4ad]" /><h2 className="mt-4 text-lg font-semibold">No {tabs.find(item => item.key === tab)?.label.toLowerCase()} mocks</h2><p className="mt-1 text-sm text-[#716c76]">Mocks will appear here when they match this stage.</p></section>}
  </main>
}
