'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, CircleAlert, GripVertical, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { dashboardQueryKeys } from '@/lib/dashboard-session'

type Tutor = { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; role?: string }
type Viewer = { id: string; role?: string; school_id?: string | null }
type SubjectRow = { id: string; name: string; tutorId: string }
type ClassKind = 'single' | 'multiple'

const newSubject = (tutorId = ''): SubjectRow => ({ id: crypto.randomUUID(), name: '', tutorId })

function tutorName(tutor: Tutor) {
  return [tutor.first_name, tutor.last_name].filter(Boolean).join(' ') || tutor.email || 'Unnamed tutor'
}

export function ClassBuilder() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [accountType, setAccountType] = useState<'centre' | 'independent'>('centre')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [payoutReady, setPayoutReady] = useState<boolean | null>(null)
  const [kind, setKind] = useState<ClassKind>('single')
  const [studentMode, setStudentMode] = useState<'group' | 'one_to_one'>('group')
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [saving, setSaving] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)

  const independent = accountType === 'independent'

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return router.replace('/auth/login')
        const headers = { Authorization: `Bearer ${session.access_token}` }
        const profileResponse = await fetch(`${apiUrl}/auth/me`, { headers })
        if (!profileResponse.ok) throw new Error('Could not verify class permissions')
        const profileBody = await profileResponse.json()
        if (profileBody.user?.role !== 'admin') { if (active) setAccessDenied(true); return }
        const [tutorsResponse, schoolResponse, payoutResponse] = await Promise.all([
          fetch(`${apiUrl}/users?roles=admin,tutor`, { headers }),
          fetch(`${apiUrl}/schools/me`, { headers }),
          fetch(`${apiUrl}/payments/summary`, { headers }),
        ])
        if (!tutorsResponse.ok || !schoolResponse.ok) throw new Error('Could not load the people available for this class')
        const [tutorsBody, schoolBody] = await Promise.all([tutorsResponse.json(), schoolResponse.json()])
        if (!active) return
        const currentViewer = profileBody.user as Viewer
        const mode = schoolBody.data?.account_type === 'independent' ? 'independent' : 'centre'
        setViewer(currentViewer)
        setAccountType(mode)
        setTutors((tutorsBody.data || []).filter((person: Tutor) => person.role === 'admin' || person.role === 'tutor'))
        setSubjects([newSubject(mode === 'independent' ? currentViewer.id : '')])
        if (payoutResponse.ok) {
          const payoutBody = await payoutResponse.json()
          setPayoutReady(Boolean(payoutBody.data?.subaccount?.subaccount_code))
        } else setPayoutReady(false)
      } catch (error) {
        toast.error('Could not start class setup', { description: error instanceof Error ? error.message : 'Please refresh and try again.' })
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [apiUrl, router, supabase])

  useEffect(() => {
    if (kind === 'single' && subjects.length > 1) setSubjects(current => [current[0]])
  }, [kind, subjects.length])

  const updateSubject = (id: string, changes: Partial<SubjectRow>) => setSubjects(current => current.map(subject => subject.id === id ? { ...subject, ...changes } : subject))
  const addSubject = () => {
    const subject = newSubject(independent ? viewer?.id || '' : '')
    setSubjects(current => [...current, subject])
    window.setTimeout(() => document.getElementById(`subject-${subject.id}`)?.focus(), 0)
  }
  const removeSubject = (id: string) => setSubjects(current => current.length === 1 ? current : current.filter(subject => subject.id !== id))

  const names = subjects.map(subject => subject.name.trim().toLowerCase()).filter(Boolean)
  const subjectNamesValid = subjects.length > 0 && subjects.every(subject => subject.name.trim()) && new Set(names).size === names.length
  const isPaid = price.trim() !== '0'
  const feeIsValid = price.trim() !== '' && Number.isFinite(Number(price)) && Number(price) >= 0
  const isReady = Boolean(name.trim()) && subjectNamesValid && feeIsValid

  async function saveClass(publish = false) {
    if (!name.trim()) return toast.error('Give this class a name')
    if (!subjectNamesValid) return toast.error('Add a name to every subject and remove duplicates')
    if (!feeIsValid) return toast.error('Enter a valid class fee')
    if (isPaid && !payoutReady) return toast.error('Set up your payout account before creating a paid class', { description: 'Students cannot pay until you add where your earnings should be sent.' })
    if (publish && !independent && subjects.some(subject => !subject.tutorId)) return toast.error('Assign a tutor to every subject before publishing')
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired')
      const response = await fetch(`${apiUrl}/classes/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          teaching_mode: studentMode,
          price: Number(price),
          subjects: subjects.map(subject => ({
            name: subject.name.trim(),
            tutor_ids: independent ? [viewer?.id].filter(Boolean) : subject.tutorId ? [subject.tutorId] : [],
          })),
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not create this class')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['programmes'] }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.schedule }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.timetable }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.summary }),
      ])
      const classId = body.data.programme.id as string
      if (publish) {
        const publishResponse = await fetch(`${apiUrl}/classes/${classId}/publish`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const publishBody = await publishResponse.json().catch(() => null)
        if (!publishResponse.ok) {
          toast.error('Class saved as a draft', { description: publishBody?.error || 'It could not be published yet. Finish the missing setup in the class workspace.' })
        } else {
          toast.success('Class published', { description: 'Students can now enrol and access it.' })
        }
      } else {
        toast.success('Draft class saved', { description: 'Students cannot see it yet. Add students, sessions and teaching materials before publishing.' })
      }
      router.push(`/dashboard/classes/${classId}${studentMode === 'one_to_one' ? '?tab=learners&add_student=true' : ''}`)
    } catch (error) {
      toast.error('Could not save class', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="mx-auto max-w-3xl rounded-2xl border border-dashboard-outline bg-white p-10 text-center text-sm text-dashboard-muted">Preparing class setup…</div>
  if (accessDenied) return <main className="max-w-2xl"><section className="rounded-2xl border border-dashboard-outline bg-white p-7 shadow-dashboard-card"><p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">Class setup</p><h1 className="mt-2 text-2xl font-bold text-[#180d62]">Your centre admin creates classes</h1><p className="mt-3 max-w-xl text-sm leading-6 text-dashboard-muted">Once you are assigned to a subject, you can schedule sessions, publish materials, and assign assessments for that subject.</p><Link href="/dashboard/classes" className="mt-6 inline-flex rounded-lg bg-[#312783] px-4 py-2.5 text-sm font-bold text-white">Back to classes</Link></section></main>

  // DashboardShell already supplies the responsive page gutter. This route
  // must not add a second one or it becomes visibly inset versus Classes.
  return <main className="w-full md:-mt-3">
    <Link href="/dashboard/classes" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#514b5b] hover:text-[#211969]"><ArrowLeft size={17} /> Back to classes</Link>
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="overflow-hidden rounded-2xl border border-dashboard-outline bg-white shadow-dashboard-card">
        <header className="border-b border-dashboard-outline px-5 py-5 sm:px-8 sm:py-7">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-dashboard-accent">New class</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#180d62] sm:text-3xl">Set up the teaching space</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-dashboard-muted">Save it as a draft to finish later, or publish it immediately when it is ready for students.</p>
        </header>

        <div className="space-y-8 p-5 sm:p-8">
          <div>
            <label htmlFor="class-name" className="text-sm font-bold text-[#27242d]">Class name</label>
            <p className="mt-1 text-sm text-dashboard-muted">Give this class a name your students will recognise.</p>
            <input ref={firstInputRef} id="class-name" autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="e.g. JAMB 2027 preparation" className="mt-3 min-h-12 w-full rounded-xl border border-[#beb8c5] bg-white px-4 text-base text-[#27242d] outline-none transition focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10" />
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-[#27242d]">How should students join this class?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setPrice('0')} className={`rounded-xl border p-4 text-left transition ${!isPaid ? 'border-[#312783] bg-[#f1efff] ring-1 ring-[#312783]' : 'border-[#ded9e0] bg-white hover:border-[#8e87bd]'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${!isPaid ? 'border-[#312783] bg-[#312783] text-white' : 'border-[#9c96a0] text-transparent'}`}><Check size={15}/></span><span className="mt-3 block text-base font-bold text-[#27242d]">Free</span><span className="mt-1 block text-sm leading-5 text-dashboard-muted">Students can enrol without paying.</span></button>
              <button type="button" onClick={() => setPrice(current => current === '0' ? '' : current)} className={`rounded-xl border p-4 text-left transition ${isPaid ? 'border-[#312783] bg-[#f1efff] ring-1 ring-[#312783]' : 'border-[#ded9e0] bg-white hover:border-[#8e87bd]'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${isPaid ? 'border-[#312783] bg-[#312783] text-white' : 'border-[#9c96a0] text-transparent'}`}><Check size={15}/></span><span className="mt-3 block text-base font-bold text-[#27242d]">Paid</span><span className="mt-1 block text-sm leading-5 text-dashboard-muted">Students pay once to enrol.</span></button>
            </div>
            {isPaid && <div className="mt-4 max-w-sm"><label htmlFor="class-fee" className="text-sm font-bold text-[#27242d]">Class fee</label><div className="mt-2 flex rounded-lg border border-[#beb8c5] bg-white focus-within:border-[#312783] focus-within:ring-4 focus-within:ring-[#312783]/10"><span className="border-r border-[#beb8c5] bg-[#f5f3f2] px-3 py-3 text-sm text-[#514b5b]">₦</span><input id="class-fee" type="number" min="1" inputMode="numeric" value={price} onChange={event => setPrice(event.target.value)} placeholder="e.g. 15000" className="min-h-11 min-w-0 flex-1 rounded-r-lg px-3 text-sm outline-none" /></div>{payoutReady === false ? <p className="mt-3 text-sm leading-5 text-[#8a5b16]">Set up your payout account before creating a paid class. <Link href="/dashboard/payments" className="font-bold underline">Set up payments</Link></p> : payoutReady ? <p className="mt-3 text-sm text-[#1e6234]">Your payout account is ready.</p> : null}</div>}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold text-[#27242d]">Who will you teach?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setStudentMode('one_to_one')} className={`rounded-xl border p-4 text-left transition ${studentMode === 'one_to_one' ? 'border-[#312783] bg-[#f1efff] ring-1 ring-[#312783]' : 'border-[#ded9e0] bg-white hover:border-[#8e87bd]'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${studentMode === 'one_to_one' ? 'border-[#312783] bg-[#312783] text-white' : 'border-[#9c96a0] text-transparent'}`}><Check size={15}/></span><span className="mt-3 block text-base font-bold text-[#27242d]">One student</span><span className="mt-1 block text-sm leading-5 text-dashboard-muted">We’ll take you straight to add the student after saving.</span></button>
              <button type="button" onClick={() => setStudentMode('group')} className={`rounded-xl border p-4 text-left transition ${studentMode === 'group' ? 'border-[#312783] bg-[#f1efff] ring-1 ring-[#312783]' : 'border-[#ded9e0] bg-white hover:border-[#8e87bd]'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${studentMode === 'group' ? 'border-[#312783] bg-[#312783] text-white' : 'border-[#9c96a0] text-transparent'}`}><Check size={15}/></span><span className="mt-3 block text-base font-bold text-[#27242d]">A group of students</span><span className="mt-1 block text-sm leading-5 text-dashboard-muted">You can add students from the class workspace when you are ready.</span></button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold text-[#27242d]">What will you teach in this class?</legend>
            <p className="mt-1 text-sm text-dashboard-muted">This only sets the starting structure. You can manage subjects later.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setKind('single')} className={`min-h-[118px] rounded-xl border p-4 text-left transition ${kind === 'single' ? 'border-[#312783] bg-[#f1efff] ring-1 ring-[#312783]' : 'border-[#ded9e0] bg-white hover:border-[#8e87bd]'}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${kind === 'single' ? 'border-[#312783] bg-[#312783] text-white' : 'border-[#9c96a0] text-transparent'}`}><Check size={15}/></span>
                <span className="mt-3 block text-base font-bold text-[#27242d]">One subject</span>
              </button>
              <button type="button" onClick={() => setKind('multiple')} className={`min-h-[118px] rounded-xl border p-4 text-left transition ${kind === 'multiple' ? 'border-[#312783] bg-[#f1efff] ring-1 ring-[#312783]' : 'border-[#ded9e0] bg-white hover:border-[#8e87bd]'}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${kind === 'multiple' ? 'border-[#312783] bg-[#312783] text-white' : 'border-[#9c96a0] text-transparent'}`}><Check size={15}/></span>
                <span className="mt-3 block text-base font-bold text-[#27242d]">Several subjects</span>
              </button>
            </div>
          </fieldset>

          <section aria-labelledby="subjects-title">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="subjects-title" className="text-sm font-bold text-[#27242d]">{kind === 'single' ? 'Subject' : 'Subjects'}</h2>{kind === 'multiple' ? <p className="mt-1 text-sm text-dashboard-muted">Add every subject taught in this class.</p> : null}</div>{kind === 'multiple' && <button type="button" onClick={addSubject} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#312783] px-3 text-sm font-bold text-[#312783] hover:bg-[#f1efff]"><Plus size={17}/> Add subject</button>}</div>
            <div className="mt-4 space-y-3">
              {subjects.map((subject, index) => <article key={subject.id} className="rounded-xl border border-[#ded9e0] bg-[#fcfbff] p-3.5 sm:p-4">
                <div className={`grid gap-3 sm:items-end ${independent ? 'sm:grid-cols-[24px_minmax(0,1fr)_40px]' : 'sm:grid-cols-[24px_minmax(0,1fr)_minmax(190px,.7fr)_40px]'}`}>
                  <div className="hidden pb-3 text-[#928b97] sm:block"><GripVertical size={18}/></div>
                  <div><label htmlFor={`subject-${subject.id}`} className="text-xs font-bold uppercase tracking-[.12em] text-[#625e69]">Subject {kind === 'multiple' ? index + 1 : ''}</label><input id={`subject-${subject.id}`} value={subject.name} onChange={event => updateSubject(subject.id, { name: event.target.value })} placeholder="e.g. Physics" className="mt-2 min-h-11 w-full rounded-lg border border-[#beb8c5] bg-white px-3 text-sm outline-none focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10" /></div>
                  {!independent && <div><label htmlFor={`tutor-${subject.id}`} className="text-xs font-bold uppercase tracking-[.12em] text-[#625e69]">Assigned tutor <span className="normal-case font-medium">(optional)</span></label><select id={`tutor-${subject.id}`} value={subject.tutorId} onChange={event => updateSubject(subject.id, { tutorId: event.target.value })} className="mt-2 min-h-11 w-full rounded-lg border border-[#beb8c5] bg-white px-3 text-sm outline-none focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10"><option value="">Assign later</option>{tutors.map(tutor => <option key={tutor.id} value={tutor.id}>{tutorName(tutor)}{tutor.id === viewer?.id ? ' (you)' : ''}</option>)}</select></div>}
                  <button type="button" disabled={subjects.length === 1} onClick={() => removeSubject(subject.id)} aria-label={`Remove ${subject.name || `subject ${index + 1}`}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-[#9c3341] transition hover:border-[#f5c7ce] hover:bg-[#fff4f5] disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={18}/></button>
                </div>
                {!independent && !subject.tutorId && <p className="mt-3 flex items-start gap-2 rounded-lg bg-[#fff8e8] px-3 py-2 text-xs leading-5 text-[#765a13]"><CircleAlert size={15} className="mt-0.5 shrink-0"/>You can save this draft without a tutor. Assign one before scheduling or publishing work for this subject.</p>}
              </article>)}
            </div>
          </section>

          <details className="rounded-xl border border-[#ded9e0] bg-[#fcfbff] p-4"><summary className="cursor-pointer text-sm font-bold text-[#312783]">Add a description <span className="font-normal text-dashboard-muted">(optional)</span></summary><textarea value={description} onChange={event => setDescription(event.target.value)} rows={4} placeholder="What are your students preparing for?" className="mt-4 w-full rounded-lg border border-[#beb8c5] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10" /></details>
        </div>
        <footer className="flex flex-col-reverse gap-3 border-t border-dashboard-outline bg-[#fbf9f8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"><Link href="/dashboard/classes" className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-bold text-[#514b5b] hover:bg-white">Cancel</Link><div className="flex flex-col gap-2 sm:flex-row"><button type="button" disabled={!isReady || saving} onClick={() => void saveClass(false)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#312783] bg-white px-5 text-sm font-bold text-[#312783] transition hover:bg-[#f1efff] disabled:cursor-not-allowed disabled:opacity-45">{saving ? 'Saving…' : 'Save draft'}</button><button type="button" disabled={!isReady || saving} onClick={() => void saveClass(true)} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#312783] px-5 text-sm font-bold text-white transition hover:bg-[#241c70] disabled:cursor-not-allowed disabled:opacity-45">{saving ? 'Publishing…' : 'Publish class'}</button></div></footer>
      </section>

      <aside className="h-fit rounded-2xl border border-[#ded9e0] bg-[#f8f7ff] p-5 lg:sticky lg:top-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#6d61ab]">What happens next</p><ol className="mt-4 space-y-4 text-sm text-[#514b5b]"><li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#312783] text-xs font-bold text-white">1</span><span><strong className="block text-[#27242d]">Save the draft</strong>It is visible only to your team.</span></li><li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#a8a1d0] text-xs font-bold text-[#312783]">2</span><span><strong className="block text-[#27242d]">Set up the class</strong>Add students, schedule sessions, and organise materials.</span></li><li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#a8a1d0] text-xs font-bold text-[#312783]">3</span><span><strong className="block text-[#27242d]">Publish when ready</strong>Students can then enrol and access the class.</span></li></ol></aside>
    </div>
  </main>
}
