'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
  FolderOpen,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  Video,
} from 'lucide-react'

export type ClassSessionItem = {
  id: string
  title: string
  subject: string
  startsAt: string
  endsAt?: string | null
  status: 'scheduled' | 'live' | 'completed' | 'cancelled'
  recurrenceLabel?: string | null
  attendeeCount?: number | null
}

export type ClassRecurringSlotItem = {
  id: string
  title: string
  subject: string
  weekday: number
  startTime: string
  durationMinutes?: number | null
}

export type ClassAssessmentItem = {
  id: string
  title: string
  subject?: string | null
  type: 'mock' | 'assignment' | 'quiz' | 'test'
  status: 'draft' | 'scheduled' | 'open' | 'closed'
  dueAt?: string | null
  attempts?: number | null
  learnerCount?: number | null
}

export type ClassMaterialItem = {
  id: string
  title: string
  subject?: string | null
  type: 'document' | 'link' | 'video' | 'worksheet'
  publishedAt?: string | null
  description?: string | null
  downloadUrl?: string | null
  fileType?: string | null
  fileName?: string | null
  fileSizeBytes?: number | null
}

export type LearnerRow = {
  id: string
  name: string
  initials?: string
  latestResult?: number | null
  attendedSessions?: number | null
  scheduledSessions?: number | null
  lastActivityLabel?: string | null
  attention: 'needs_attention' | 'on_track' | 'no_signal'
  attentionReason?: string | null
}

export type TopicSignal = {
  topic: string
  state: 'strong' | 'developing' | 'needs_attention' | 'no_signal'
  detail?: string | null
}

export type AttentionSignal = {
  learnerId: string
  learnerName: string
  kind: 'declining' | 'repeated_errors' | 'low_participation' | 'missing_assessments'
  detail: string
}

export type ClassPerformanceData = {
  attendanceLabel?: string | null
  learnersNeedingAttention: number
  topics: TopicSignal[]
  attention: AttentionSignal[]
  insightSummary?: string | null
}

export type LearnerPerformanceData = {
  name: string
  recentScore?: number | null
  previousScore?: number | null
  trend?: 'up' | 'down' | 'steady' | 'no_signal'
  attendanceLabel?: string | null
  topics: TopicSignal[]
  assessments: Array<{ id: string; title: string; score?: number | null; dateLabel?: string | null }>
  insightSummary?: string | null
  recommendedAction?: string | null
}

type Action = { label: string; onClick: () => void; disabled?: boolean; icon?: ReactNode }

const dateTime = (value: string) => new Intl.DateTimeFormat(undefined, {
  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(value))

const statusStyle: Record<ClassSessionItem['status'], string> = {
  scheduled: 'bg-[#eef0ff] text-[#312783]',
  live: 'bg-[#fce8e5] text-[#a1291b]',
  completed: 'bg-[#e8f4ec] text-[#1e6234]',
  cancelled: 'bg-[#f4f1f2] text-[#655f67]',
}

const assessmentStatusStyle: Record<ClassAssessmentItem['status'], string> = {
  draft: 'bg-[#f4f1f2] text-[#655f67]', scheduled: 'bg-[#fff3d7] text-[#765a13]',
  open: 'bg-[#e8f4ec] text-[#1e6234]', closed: 'bg-[#eef0ff] text-[#312783]',
}

function Panel({ eyebrow, title, description, action, children }: {
  eyebrow?: string; title: string; description?: string; action?: Action; children: ReactNode
}) {
  return <section className="rounded-2xl border border-dashboard-outline bg-white shadow-dashboard-card">
    <header className="flex flex-col gap-3 border-b border-dashboard-outline px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div>
        {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[.14em] text-dashboard-accent">{eyebrow}</p> : null}
        <h2 className="mt-1 text-xl font-bold tracking-tight text-[#180d62]">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-dashboard-muted">{description}</p> : null}
      </div>
      {action ? <button type="button" disabled={action.disabled} onClick={action.onClick} className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-[#312783] px-3.5 text-sm font-bold text-[#312783] hover:bg-[#f1efff] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{action.icon || <ArrowUpRight size={16}/>} {action.label}</button> : null}
    </header>
    {children}
  </section>
}

function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: Action }) {
  return <div className="flex min-h-[250px] flex-col items-center justify-center px-5 py-10 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1efff] text-[#312783]">{icon}</div>
    <h3 className="mt-4 text-base font-bold text-[#27242d]">{title}</h3>
    <p className="mt-1 max-w-sm text-sm leading-6 text-dashboard-muted">{body}</p>
    {action ? <button type="button" onClick={action.onClick} className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-[#312783] px-4 text-sm font-bold text-white hover:bg-[#241c70]">{action.label}</button> : null}
  </div>
}

export function ClassSchedulePanel({ sessions, recurringSlots = [], onAddSession, onOpenSession, onStartSession }: {
  sessions: ClassSessionItem[]; recurringSlots?: ClassRecurringSlotItem[]; onAddSession?: () => void; onOpenSession?: (session: ClassSessionItem) => void; onStartSession?: (session: ClassSessionItem) => void
}) {
  const action = onAddSession ? { label: 'Schedule live class', onClick: onAddSession } : undefined
  const [tab, setTab] = useState<'upcoming' | 'past' | 'recurring'>('upcoming')
  const visibleSessions = useMemo(() => {
    const now = Date.now()
    return sessions.filter((session) => tab === 'upcoming'
      ? session.status === 'live' || (session.status === 'scheduled' && new Date(session.startsAt).getTime() >= now)
      : session.status === 'completed' || session.status === 'cancelled' || new Date(session.startsAt).getTime() < now,
    ).sort((a, b) => tab === 'upcoming'
      ? new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      : new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
  }, [sessions, tab])

  return <Panel eyebrow="Class schedule" title="Sessions" description="Plan and review the dated teaching sessions for this class." action={action}>
    <div className="flex gap-5 border-b border-dashboard-outline px-5 sm:px-6">
      {(['upcoming', 'past', 'recurring'] as const).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`border-b-2 px-0 py-3 text-sm font-bold capitalize transition ${tab === item ? 'border-[#994704] text-[#211969]' : 'border-transparent text-[#625e69] hover:text-[#211969]'}`}>{item === 'recurring' ? 'Recurring' : `${item} sessions`}</button>)}
    </div>
    {tab === 'recurring' ? (!recurringSlots.length ? <EmptyState icon={<CalendarClock size={23}/>} title="No recurring sessions" body="Add a recurring teaching time when this class meets on a regular weekly rhythm." action={action}/> : <div className="divide-y divide-dashboard-outline">{recurringSlots.map((slot) => <article key={slot.id} className="flex items-start gap-3 px-5 py-4 sm:px-6"><div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1efff] text-[#312783]"><CalendarClock size={18}/></div><div className="min-w-0 flex-1"><p className="font-bold text-[#27242d]">{slot.title}</p><p className="mt-1 text-sm text-dashboard-muted">{slot.subject} · {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][slot.weekday - 1] || 'Weekly'} · {slot.startTime.slice(0, 5)}</p>{slot.durationMinutes ? <p className="mt-1 text-xs text-[#655f67]">{slot.durationMinutes} minutes</p> : null}</div></article>)}</div>) : !visibleSessions.length ? <EmptyState icon={<CalendarClock size={23}/>} title={tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'} body={tab === 'upcoming' ? 'Add a session for this class when you are ready to teach.' : 'Completed and cancelled sessions will appear here.'} action={tab === 'upcoming' ? action : undefined}/> : <div className="divide-y divide-dashboard-outline">
      {visibleSessions.map(session => <article key={session.id} className="flex items-start gap-3 px-5 py-4 sm:px-6">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1efff] text-[#312783]"><CalendarClock size={18}/></div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-[#27242d]">{session.title}</p>{session.status !== 'scheduled' ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${statusStyle[session.status]}`}>{session.status}</span> : null}</div><p className="mt-1 text-sm text-dashboard-muted">{session.subject} · {dateTime(session.startsAt)}</p>{session.recurrenceLabel || session.attendeeCount !== null ? <p className="mt-1 text-xs text-[#655f67]">{[session.recurrenceLabel, session.attendeeCount !== null && session.attendeeCount !== undefined ? `${session.attendeeCount} students` : null].filter(Boolean).join(' · ')}</p> : null}</div>
        <div className="mt-1 flex shrink-0 items-center gap-1">{session.status === 'scheduled' || session.status === 'live' ? <button type="button" onClick={() => onStartSession?.(session)} aria-label={session.status === 'live' ? `Join ${session.title}` : `Start ${session.title}`} title={session.status === 'live' ? 'Join class' : 'Start class'} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#312783] text-white hover:bg-[#241c70]"><Video size={16}/></button> : null}<button type="button" onClick={() => onOpenSession?.(session)} aria-label={`Open ${session.title} session details`} className="rounded-lg p-2 text-[#625e69] transition hover:bg-[#f1efff] hover:text-[#180d62]"><ChevronRight size={18}/></button></div>
      </article>)}
    </div>}
  </Panel>
}

export function ClassAssessmentsPanel({ assessments, onCreate, onCreateAssignment, onOpen, openCreateSignal }: {
  assessments: ClassAssessmentItem[]; onCreate?: () => void; onCreateAssignment?: () => void; onOpen?: (assessment: ClassAssessmentItem) => void; openCreateSignal?: number
}) {
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [filter, setFilter] = useState<'all' | 'mock' | 'test' | 'assignment'>('all')
  useEffect(() => { if (openCreateSignal) setShowCreateMenu(true) }, [openCreateSignal])
  const action = onCreate ? { label: 'Create assessment', onClick: onCreate } : undefined
  const typeLabel = (type: ClassAssessmentItem['type']) => type === 'mock' ? 'Quiz' : type === 'assignment' ? 'Assignment' : type === 'quiz' ? 'Quiz' : 'Test'
  const typeStyle: Record<ClassAssessmentItem['type'], string> = {
    mock: 'bg-[#fff3d7] text-[#765a13]', quiz: 'bg-[#eef0ff] text-[#312783]', test: 'bg-[#f1efff] text-[#5d55a0]', assignment: 'bg-[#e8f4ec] text-[#1e6234]',
  }
  return <>
    <Panel eyebrow="Assessment activity" title="Assessments" description="Quizzes and assignments for this class." action={onCreate ? { label: 'Create assessment', onClick: () => setShowCreateMenu(true) } : undefined}>
      <div className="flex gap-5 border-b border-dashboard-outline px-5 sm:px-6">
        {[['All', 'all'], ['Quizzes', 'mock'], ['Assignments', 'assignment']].map(([label, value]) => <button key={label} type="button" onClick={() => setFilter(value as typeof filter)} className={`border-b-2 px-0 py-3 text-sm font-bold ${filter === value ? 'border-[#994704] text-[#211969]' : 'border-transparent text-[#625e69]'}`}>{label}</button>)}
      </div>
      {(() => { const visible = filter === 'all' ? assessments : assessments.filter((assessment) => assessment.type === filter); return !visible.length ? <EmptyState icon={<FileText size={23}/>} title={filter === 'all' ? 'No assessments assigned' : `No ${filter === 'mock' ? 'quizzes' : `${filter}s`} yet`} body="Create an assessment for this class when you are ready." action={onCreate ? { label: 'Create assessment', onClick: () => setShowCreateMenu(true) } : undefined}/> : <div className="divide-y divide-dashboard-outline">
        {visible.map(assessment => <button type="button" key={assessment.id} onClick={() => onOpen?.(assessment)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-[#fbfaff] sm:px-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1efff] text-[#312783]"><FileText size={18}/></div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-bold text-[#27242d]">{assessment.title}</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${typeStyle[assessment.type]}`}>{typeLabel(assessment.type)}</span></div><p className="mt-1 text-xs text-dashboard-muted">{assessment.attempts ?? 0} submitted{assessment.dueAt ? ` · Due ${dateTime(assessment.dueAt)}` : ''}</p></div>
          <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex ${assessmentStatusStyle[assessment.status]}`}>{assessment.status === 'open' ? 'Open' : assessment.status === 'draft' ? 'Draft' : assessment.status === 'scheduled' ? 'Scheduled' : 'Closed'}</span><MoreHorizontal className="shrink-0 text-[#8c8692]" size={18}/>
        </button>)}
      </div> })()}
    </Panel>
    {showCreateMenu ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#180d62]/25 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="create-assessment-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreateMenu(false) }}>
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6 sm:pb-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">New assessment</p><h3 id="create-assessment-title" className="mt-1 text-xl font-bold text-[#180d62]">What are you creating?</h3><p className="mt-1 text-sm text-dashboard-muted">Choose how students in this class will be assessed.</p></div><button type="button" onClick={() => setShowCreateMenu(false)} aria-label="Close" className="rounded-lg p-2 text-[#625e69] hover:bg-[#f1efff]"><span className="material-symbols-outlined">close</span></button></div><div className="mt-5 grid gap-3"><button type="button" onClick={() => { setShowCreateMenu(false); onCreate?.() }} className="flex items-start gap-3 rounded-xl border border-[#d8d2f1] p-4 text-left hover:bg-[#f8f6ff]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff3d7] text-[#765a13]"><BookOpen size={19}/></span><span><span className="block font-bold text-[#27242d]">Quiz</span><span className="mt-1 block text-sm leading-5 text-dashboard-muted">Add questions or import a document, then publish it for this class.</span></span></button><button type="button" onClick={() => { setShowCreateMenu(false); onCreateAssignment?.() }} className="flex items-start gap-3 rounded-xl border border-[#d8d2f1] p-4 text-left hover:bg-[#f8f6ff]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4ec] text-[#1e6234]"><FileText size={19}/></span><span><span className="block font-bold text-[#27242d]">Assignment</span><span className="mt-1 block text-sm leading-5 text-dashboard-muted">Give students instructions, resources and a due date, then review submissions.</span></span></button></div></div>
    </div> : null}
  </>
}

export function ClassMaterialsPanel({ materials, onAdd, onOpen }: {
  materials: ClassMaterialItem[]; onAdd?: () => void; onOpen?: (material: ClassMaterialItem) => void
}) {
  const action = onAdd ? { label: 'Upload material', onClick: onAdd, icon: <Plus size={16}/> } : undefined
  const [preview, setPreview] = useState<ClassMaterialItem | null>(null)
  const [filter, setFilter] = useState<'all' | 'pdf' | 'notes' | 'video' | 'recordings'>('all')
  const visible = materials.filter((material) => {
    if (filter === 'all') return true
    if (filter === 'video') return material.type === 'video'
    if (filter === 'pdf') return material.fileType === 'pdf'
    if (filter === 'notes') return material.type === 'document' && material.fileType !== 'pdf'
    return false
  })
  const open = (material: ClassMaterialItem) => material.type === 'video' && material.downloadUrl ? setPreview(material) : onOpen?.(material)
  return <><section>
    <div className="flex flex-col gap-3 border-b border-dashboard-outline pb-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{([['All', 'all'], ['Notes', 'notes'], ['PDFs', 'pdf'], ['Videos', 'video'], ['Recordings', 'recordings']] as const).map(([label, value]) => <button type="button" key={value} onClick={() => setFilter(value)} className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-bold transition ${filter === value ? 'border-[#312783] bg-[#312783] text-white' : 'border-[#d8d2e5] bg-white text-[#625e69] hover:bg-[#f5f3ff]'}`}>{label}</button>)}</div>{action ? <button type="button" onClick={action.onClick} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#312783] px-4 text-sm font-bold text-white hover:bg-[#241c70]"><Plus size={17}/> Upload material</button> : null}</div>
    <div className="mt-4 overflow-hidden rounded-xl border border-dashboard-outline bg-white shadow-dashboard-card">{!visible.length ? <EmptyState icon={<FolderOpen size={23}/>} title={filter === 'recordings' ? 'No recordings yet' : 'No materials yet'} body={filter === 'recordings' ? 'Recorded live classes will appear here when they are available.' : 'Upload a document, image or video and attach it to a subject in this class.'} action={filter === 'recordings' ? undefined : action}/> : <div className="divide-y divide-dashboard-outline">
      {visible.map(material => <article key={material.id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-[#fbfaff] sm:px-6"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${material.type === 'video' ? 'bg-[#eeeafe] text-[#312783]' : material.fileType === 'pdf' ? 'bg-[#fff0ee] text-[#a1291b]' : 'bg-[#f1efff] text-[#312783]'}`}>{material.type === 'video' ? <Video size={18}/> : <BookOpen size={18}/>}</div><button type="button" onClick={() => open(material)} className="min-w-0 flex-1 text-left"><p className="truncate font-bold text-[#27242d]">{material.title}</p><p className="mt-1 truncate text-xs text-[#625e69]">{[material.fileType?.toUpperCase() || material.type, material.subject, material.fileSizeBytes ? formatBytes(material.fileSizeBytes) : null].filter(Boolean).join(' · ')}</p></button>{material.type === 'video' ? <button type="button" onClick={() => open(material)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-bold text-[#312783] hover:bg-[#f1efff]" aria-label={`Watch ${material.title}`}><Play size={17}/> <span className="hidden sm:inline">Watch</span></button> : material.downloadUrl ? <a href={material.downloadUrl} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-bold text-[#312783] hover:bg-[#f1efff]" aria-label={`Download ${material.title}`} title="Download material"><Download size={17}/> <span className="hidden sm:inline">Download</span></a> : <button type="button" onClick={() => open(material)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-bold text-[#312783] hover:bg-[#f1efff]" aria-label={`Open ${material.title}`}><FileText size={17}/> <span className="hidden sm:inline">Open</span></button>}</article>)}
    </div>}</div>
  </section>{preview ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#180d62]/40 p-4" role="dialog" aria-modal="true" aria-label={`Preview ${preview.title}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null) }}><div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between gap-3 border-b border-dashboard-outline px-5 py-4"><div className="min-w-0"><p className="truncate font-bold text-[#180d62]">{preview.title}</p><p className="mt-0.5 text-xs text-dashboard-muted">{preview.subject}</p></div><button type="button" onClick={() => setPreview(null)} className="rounded-lg p-2 text-[#625e69] hover:bg-[#f1efff]" aria-label="Close preview"><span className="material-symbols-outlined">close</span></button></div><video controls preload="metadata" src={preview.downloadUrl || undefined} className="aspect-video w-full bg-black">Your browser cannot play this video.</video></div></div> : null}</>
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`
}

function AttentionBadge({ value }: { value: LearnerRow['attention'] }) {
  const labels = { needs_attention: 'Needs attention', on_track: 'On track', no_signal: 'No signal yet' }
  const styles = { needs_attention: 'bg-[#fce8e5] text-[#a1291b]', on_track: 'bg-[#e8f4ec] text-[#1e6234]', no_signal: 'bg-[#f4f1f2] text-[#655f67]' }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[value]}`}>{labels[value]}</span>
}

export function ClassLearnersPanel({ learners, onOpenLearner, onInvite }: {
  learners: LearnerRow[]; onOpenLearner?: (learner: LearnerRow) => void; onInvite?: () => void
}) {
  const [search, setSearch] = useState('')
  const [attention, setAttention] = useState<'all' | LearnerRow['attention']>('all')
  const visible = learners.filter((student) => {
    const matchesSearch = student.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    return matchesSearch && (attention === 'all' || student.attention === attention)
  })
  const action = onInvite ? { label: 'Add student', onClick: onInvite, icon: <Plus size={16}/> } : undefined

  return <section className="overflow-hidden rounded-2xl border border-dashboard-outline bg-white shadow-dashboard-card">
    <header className="flex flex-col gap-3 border-b border-dashboard-outline px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="relative min-w-0 flex-1 sm:max-w-md"><Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#817a86]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students" aria-label="Search students" className="min-h-10 w-full rounded-lg border border-dashboard-outline bg-white py-2 pl-10 pr-3 text-sm outline-none transition focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10"/></div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-dashboard-outline px-3 text-sm font-bold text-[#514b5b]"><SlidersHorizontal size={16}/><span className="sr-only">Filter students</span><select value={attention} onChange={(event) => setAttention(event.target.value as typeof attention)} aria-label="Filter students by attention" className="min-w-0 bg-transparent text-sm font-bold outline-none"><option value="all">All students</option><option value="needs_attention">Needs attention</option><option value="on_track">On track</option><option value="no_signal">No signal yet</option></select></label>{action ? <button type="button" onClick={action.onClick} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#312783] px-3.5 text-sm font-bold text-white hover:bg-[#241c70]">{action.icon} {action.label}</button> : null}</div>
    </header>
    {!learners.length ? <EmptyState icon={<UsersRound size={23}/>} title="No students in this class" body="Add a student when you are ready to invite them to this class." action={action}/> : !visible.length ? <div className="px-5 py-12 text-center sm:px-6"><p className="font-bold text-[#27242d]">No students found</p><p className="mt-1 text-sm text-dashboard-muted">Try a different name or filter.</p></div> : <><div className="divide-y divide-dashboard-outline sm:hidden">
      {visible.map(student => <button type="button" key={student.id} onClick={() => onOpenLearner?.(student)} className="w-full px-5 py-4 text-left hover:bg-[#fbfaff]"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-[#27242d]">{student.name}</p><p className="mt-1 text-sm text-dashboard-muted">Latest result: {student.latestResult === null || student.latestResult === undefined ? '—' : `${student.latestResult}%`} · Attendance: {student.scheduledSessions ? `${student.attendedSessions ?? 0}/${student.scheduledSessions}` : '—'}</p></div><ChevronRight className="mt-1 shrink-0 text-[#8c8692]" size={18}/></div><div className="mt-3 flex flex-wrap items-center gap-2"><AttentionBadge value={student.attention}/>{student.lastActivityLabel ? <span className="text-xs text-[#655f67]">{student.lastActivityLabel}</span> : null}</div></button>)}
    </div><div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-dashboard-outline bg-[#fbfaff] text-[11px] font-bold uppercase tracking-[.11em] text-[#625e69]"><tr><th className="px-6 py-3">Student</th><th className="px-4 py-3">Latest result</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">Last activity</th><th className="px-4 py-3">Attention</th><th className="w-10 px-4 py-3"><span className="sr-only">Open student</span></th></tr></thead><tbody className="divide-y divide-dashboard-outline">{visible.map(student => <tr key={student.id} onClick={() => onOpenLearner?.(student)} className="cursor-pointer transition hover:bg-[#fbfaff]"><td className="px-6 py-4 font-bold text-[#27242d]">{student.name}</td><td className="px-4 py-4 text-[#46414a]">{student.latestResult === null || student.latestResult === undefined ? '—' : `${student.latestResult}%`}</td><td className="px-4 py-4 text-[#46414a]">{student.scheduledSessions ? `${student.attendedSessions ?? 0}/${student.scheduledSessions}` : '—'}</td><td className="px-4 py-4 text-[#625e69]">{student.lastActivityLabel || 'No activity yet'}</td><td className="px-4 py-4"><AttentionBadge value={student.attention}/></td><td className="px-4 py-4"><ChevronRight className="text-[#8c8692]" size={18}/></td></tr>)}</tbody></table></div></>}
  </section>
}

function TopicPill({ signal }: { signal: TopicSignal }) {
  const label = { strong: 'Strong', developing: 'Developing', needs_attention: 'Needs attention', no_signal: 'No signal yet' }[signal.state]
  const style = { strong: 'bg-[#e8f4ec] text-[#1e6234]', developing: 'bg-[#fff3d7] text-[#765a13]', needs_attention: 'bg-[#fce8e5] text-[#a1291b]', no_signal: 'bg-[#f4f1f2] text-[#655f67]' }[signal.state]
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-dashboard-outline px-4 py-3"><div><p className="font-bold text-[#27242d]">{signal.topic}</p>{signal.detail ? <p className="mt-0.5 text-xs text-dashboard-muted">{signal.detail}</p> : null}</div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>{label}</span></div>
}

export function ClassPerformancePanel({ data, onOpenLearner }: { data: ClassPerformanceData; onOpenLearner?: (learnerId: string) => void }) {
  return <div className="space-y-5"><Panel eyebrow="Class health" title="Understand the class" description="See what is happening in this class and who needs your attention."><div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6"><article className="rounded-xl bg-[#f1efff] p-4"><p className="text-xs font-bold uppercase tracking-[.11em] text-[#5d55a0]">Attendance</p><p className="mt-2 text-2xl font-bold text-[#180d62]">{data.attendanceLabel || 'No signal yet'}</p><p className="mt-1 text-xs text-[#625e69]">Across scheduled sessions</p></article><article className="rounded-xl bg-[#fce8e5] p-4"><p className="text-xs font-bold uppercase tracking-[.11em] text-[#a1291b]">Needs attention</p><p className="mt-2 text-2xl font-bold text-[#7d261d]">{data.learnersNeedingAttention}</p><p className="mt-1 text-xs text-[#7d4a45]">Learners with actionable signals</p></article></div></Panel>
    <Panel title="Topic performance" description="Topics are presented as learning signals, not superficial rank order."><div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">{data.topics.length ? data.topics.map(topic => <TopicPill key={topic.topic} signal={topic}/>) : <p className="text-sm text-dashboard-muted">Topic signals will appear after assessments and teaching activity.</p>}</div></Panel>
    <Panel title="Needs attention" description="A short, actionable queue for the next tutor intervention."><div className="divide-y divide-dashboard-outline">{data.attention.length ? data.attention.map(signal => <button type="button" key={`${signal.learnerId}-${signal.kind}`} onClick={() => onOpenLearner?.(signal.learnerId)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-[#fbfaff] sm:px-6"><CircleAlert className="mt-0.5 shrink-0 text-[#a1291b]" size={18}/><div className="min-w-0 flex-1"><p className="font-bold text-[#27242d]">{signal.learnerName}</p><p className="mt-1 text-sm text-dashboard-muted">{signal.detail}</p></div><ChevronRight className="mt-1 shrink-0 text-[#8c8692]" size={18}/></button>) : <p className="px-5 py-6 text-sm text-dashboard-muted sm:px-6">No learners need attention from the available evidence.</p>}</div></Panel>
    {data.insightSummary ? <div className="rounded-2xl border border-[#cbc4ee] bg-[#f8f6ff] p-5 sm:p-6"><div className="flex items-center gap-2 text-[#312783]"><Sparkles size={18}/><p className="text-sm font-bold">Kanvise insight</p></div><p className="mt-3 max-w-3xl text-sm leading-6 text-[#46414a]">{data.insightSummary}</p></div> : null}
  </div>
}

export function LearnerPerformancePanel({ data }: { data: LearnerPerformanceData }) {
  const trend = data.trend === 'up' ? 'Improving' : data.trend === 'down' ? 'Declining' : data.trend === 'steady' ? 'Steady' : 'No signal yet'
  return <div className="space-y-5"><Panel eyebrow="Student performance" title={data.name} description="This view is about this student’s evidence. It deliberately does not compare them against a class average."><div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6"><article className="rounded-xl bg-[#f1efff] p-4"><p className="text-xs font-bold uppercase tracking-[.11em] text-[#5d55a0]">Recent score</p><p className="mt-2 text-2xl font-bold text-[#180d62]">{data.recentScore === null || data.recentScore === undefined ? '—' : `${data.recentScore}%`}</p><p className="mt-1 text-xs text-[#625e69]">Previous: {data.previousScore === null || data.previousScore === undefined ? '—' : `${data.previousScore}%`}</p></article><article className="rounded-xl bg-[#fff3d7] p-4"><p className="text-xs font-bold uppercase tracking-[.11em] text-[#765a13]">Trend</p><p className="mt-2 text-2xl font-bold text-[#634a09]">{trend}</p><p className="mt-1 text-xs text-[#765a13]">From recent assessments</p></article><article className="rounded-xl bg-[#e8f4ec] p-4"><p className="text-xs font-bold uppercase tracking-[.11em] text-[#1e6234]">Attendance</p><p className="mt-2 text-2xl font-bold text-[#14532d]">{data.attendanceLabel || 'No signal yet'}</p><p className="mt-1 text-xs text-[#1e6234]">Sessions attended</p></article></div></Panel>
    <Panel title="Topic mastery" description="Show the topic signals that make the next teaching decision clearer."><div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">{data.topics.length ? data.topics.map(topic => <TopicPill key={topic.topic} signal={topic}/>) : <p className="text-sm text-dashboard-muted">Topic mastery will appear when enough assessment evidence is available.</p>}</div></Panel>
    <Panel title="Assessments" description="Recent evidence from this learner’s completed work."><div className="divide-y divide-dashboard-outline">{data.assessments.length ? data.assessments.map(assessment => <div key={assessment.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"><div><p className="font-bold text-[#27242d]">{assessment.title}</p><p className="mt-1 text-xs text-dashboard-muted">{assessment.dateLabel || 'Completed assessment'}</p></div><span className="text-lg font-bold text-[#180d62]">{assessment.score === null || assessment.score === undefined ? '—' : `${assessment.score}%`}</span></div>) : <p className="px-5 py-6 text-sm text-dashboard-muted sm:px-6">No completed assessments yet.</p>}</div></Panel>
    {(data.insightSummary || data.recommendedAction) ? <div className="rounded-2xl border border-[#cbc4ee] bg-[#f8f6ff] p-5 sm:p-6"><div className="flex items-center gap-2 text-[#312783]"><Sparkles size={18}/><p className="text-sm font-bold">Kanvise insight</p></div>{data.insightSummary ? <p className="mt-3 max-w-3xl text-sm leading-6 text-[#46414a]">{data.insightSummary}</p> : null}{data.recommendedAction ? <div className="mt-4 flex gap-2 rounded-xl border border-[#d8d2f1] bg-white p-3"><MessageSquareText className="mt-0.5 shrink-0 text-[#312783]" size={18}/><div><p className="text-xs font-bold uppercase tracking-[.11em] text-[#5d55a0]">Recommended action</p><p className="mt-1 text-sm leading-6 text-[#46414a]">{data.recommendedAction}</p></div></div> : null}</div> : null}
  </div>
}
