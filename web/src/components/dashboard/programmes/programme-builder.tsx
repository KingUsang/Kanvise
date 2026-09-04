'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  clearProgrammeDraft,
  loadProgrammeDraft,
  ProgrammeDraftData,
  ProgrammeDraftSubject,
  saveProgrammeDraft,
} from '@/lib/programme-draft'

type Tutor = { id: string; first_name?: string; last_name?: string; email?: string; role: string }
type Identity = { id: string; school_id: string }
type SavedProgramme = { id: string; slug: string; is_published: boolean }

const steps = [
  { title: 'Programme details', short: 'Details', icon: 'edit_note' },
  { title: 'Subjects offered', short: 'Subjects', icon: 'library_books' },
  { title: 'Assign tutors', short: 'Tutors', icon: 'group' },
  { title: 'Review', short: 'Review', icon: 'fact_check' },
]

const emptyDraft = (): ProgrammeDraftData => ({ name: '', description: '', price: '', subjects: [], step: 0 })
const newSubject = (): ProgrammeDraftSubject => ({ clientId: crypto.randomUUID(), name: '', description: '', tutorIds: [] })

export function ProgrammeBuilder({ programmeId }: { programmeId?: string }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [draft, setDraft] = useState<ProgrammeDraftData>(emptyDraft)
  const [step, setStep] = useState(0)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [savedProgramme, setSavedProgramme] = useState<SavedProgramme | null>(null)
  const [databaseSaved, setDatabaseSaved] = useState(false)
  const [coverUploadError, setCoverUploadError] = useState('')
  const [schoolSlug, setSchoolSlug] = useState('')
  const [payoutReady, setPayoutReady] = useState<boolean | null>(null)
  const initialSubjects = useRef<Map<string, string[]>>(new Map())

  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const isEditing = Boolean(programmeId)

  useEffect(() => {
    let active = true
    async function initialise() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return router.replace('/')
        const headers = { Authorization: `Bearer ${session.access_token}` }
        const requests = [fetch(`${apiUrl}/auth/me`, { headers }), fetch(`${apiUrl}/users?roles=admin,tutor`, { headers }), fetch(`${apiUrl}/schools/me`, { headers })]
        const payoutRequest = fetch(`${apiUrl}/payments/summary`, { headers })
        if (programmeId) requests.push(fetch(`${apiUrl}/programmes/${programmeId}`, { headers }))
        const responses = await Promise.all(requests)
        if (responses.some(response => !response.ok)) throw new Error('Could not load programme setup')
        const [profileBody, tutorBody, schoolBody, programmeBody] = await Promise.all(responses.map(response => response.json()))
        if (!active) return
        const currentIdentity = { id: profileBody.user.id, school_id: profileBody.user.school_id }
        setIdentity(currentIdentity)
        setTutors((tutorBody.data || []).filter((person: Tutor) => ['admin', 'tutor'].includes(person.role)))
        setSchoolSlug(schoolBody.data?.slug || '')
        const payoutResponse = await payoutRequest
        if (active) {
          if (payoutResponse.ok) {
            const payoutBody = await payoutResponse.json()
            setPayoutReady(Boolean(payoutBody.data?.subaccount?.subaccount_code))
          } else setPayoutReady(false)
        }
        const local = loadProgrammeDraft(currentIdentity.school_id, currentIdentity.id, programmeId || 'new')
        if (local) {
          setDraft(local.data)
          setStep(Math.min(Math.max(local.data.step || 0, 0), 3))
          setSavedAt(local.savedAt)
          if (programmeBody?.data) {
            initialSubjects.current = new Map((programmeBody.data.courses || []).map((subject: any) => [subject.id, subject.tutor_ids || []]))
            setSavedProgramme({ id: programmeBody.data.id, slug: programmeBody.data.slug, is_published: programmeBody.data.is_published })
          }
        } else if (programmeBody?.data) {
          const data = programmeBody.data
          const subjects = (data.courses || []).map((subject: any) => ({
            id: subject.id,
            clientId: subject.id,
            name: subject.name,
            description: subject.description || '',
            tutorIds: subject.tutor_ids || [],
          }))
          initialSubjects.current = new Map(subjects.map((subject: ProgrammeDraftSubject) => [subject.id!, subject.tutorIds]))
          setDraft({ name: data.name, description: data.description || '', price: String(data.price || 0), subjects, step: 0 })
          setSavedProgramme({ id: data.id, slug: data.slug, is_published: data.is_published })
        }
      } catch (error) {
        toast.error('Could not open programme setup', { description: error instanceof Error ? error.message : 'Please try again.' })
      } finally {
        if (active) { setLoading(false); setHydrated(true) }
      }
    }
    void initialise()
    return () => { active = false }
  }, [apiUrl, programmeId, router, supabase])

  useEffect(() => {
    if (!hydrated || !identity || databaseSaved || savedProgramme?.is_published) return
    const timer = window.setTimeout(() => {
      const value = { ...draft, step }
      saveProgrammeDraft(identity.school_id, identity.id, value, programmeId || 'new')
      setSavedAt(Date.now())
    }, 500)
    return () => window.clearTimeout(timer)
  }, [databaseSaved, draft, hydrated, identity, programmeId, savedProgramme?.is_published, step])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!hydrated || databaseSaved || savedProgramme?.is_published) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [databaseSaved, hydrated, savedProgramme?.is_published])

  const updateDraft = <K extends keyof ProgrammeDraftData>(key: K, value: ProgrammeDraftData[K]) => setDraft(current => ({ ...current, [key]: value }))
  const updateSubject = (clientId: string, changes: Partial<ProgrammeDraftSubject>) => updateDraft('subjects', draft.subjects.map(subject => subject.clientId === clientId ? { ...subject, ...changes } : subject))

  const moveSubject = (index: number, offset: number) => {
    const next = [...draft.subjects]
    const target = index + offset
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    updateDraft('subjects', next)
  }

  const detailsReady = Boolean(draft.name.trim()) && draft.price !== '' && Number.isFinite(Number(draft.price)) && Number(draft.price) >= 0
  const subjectNames = draft.subjects.map(subject => subject.name.trim().toLowerCase()).filter(Boolean)
  const subjectsReady = draft.subjects.length > 0 && draft.subjects.every(subject => subject.name.trim()) && new Set(subjectNames).size === subjectNames.length
  const tutorsReady = draft.subjects.length > 0 && draft.subjects.every(subject => subject.tutorIds.length > 0)
  const isPaid = Number(draft.price) > 0

  const nextStep = () => {
    if (step === 0 && !detailsReady) return toast.error('Add a programme name and valid fee')
    if (step === 1 && !subjectsReady) return toast.error('Add at least one uniquely named subject')
    setStep(current => Math.min(current + 1, 3))
  }

  async function token() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Your session has expired')
    return session.access_token
  }

  async function uploadCover(programme: SavedProgramme, file: File) {
    const accessToken = await token()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }
    const metadata = { file_name: file.name, content_type: file.type, file_size_bytes: file.size, entity_type: 'programme_thumbnail', context_id: programme.id }
    const presign = await fetch(`${apiUrl}/storage/presign/public`, { method: 'POST', headers, body: JSON.stringify(metadata) })
    const presignBody = await presign.json()
    if (!presign.ok) throw new Error(presignBody.error || 'Could not prepare image upload')
    const upload = await fetch(presignBody.data.presigned_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
    if (!upload.ok) throw new Error('Could not upload the cover image')
    const confirm = await fetch(`${apiUrl}/storage/public/confirm`, { method: 'POST', headers, body: JSON.stringify({ ...metadata, file_key: presignBody.data.file_key }) })
    const confirmBody = await confirm.json()
    if (!confirm.ok) throw new Error(confirmBody.error || 'Could not attach the cover image')
    setCoverUploadError('')
  }

  async function createProgramme(accessToken: string) {
    const response = await fetch(`${apiUrl}/programmes/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        name: draft.name,
        description: draft.description,
        price: Number(draft.price),
        subjects: draft.subjects.map(subject => ({ name: subject.name, description: subject.description, tutor_ids: subject.tutorIds })),
      }),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Could not create programme')
    return { id: body.data.programme.id, slug: body.data.programme.slug, is_published: false } as SavedProgramme
  }

  async function updateProgramme(accessToken: string) {
    if (!programmeId) throw new Error('Programme not found')
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }
    const programmeResponse = await fetch(`${apiUrl}/programmes/${programmeId}`, { method: 'PATCH', headers, body: JSON.stringify({ name: draft.name, description: draft.description, price: Number(draft.price) }) })
    const programmeBody = await programmeResponse.json()
    if (!programmeResponse.ok) throw new Error(programmeBody.error || 'Could not update programme')

    const retainedIds = new Set(draft.subjects.map(subject => subject.id).filter(Boolean))
    for (const existingId of initialSubjects.current.keys()) {
      if (!retainedIds.has(existingId)) {
        const response = await fetch(`${apiUrl}/courses/${existingId}`, { method: 'DELETE', headers })
        if (!response.ok) throw new Error('Could not remove a subject')
      }
    }

    const persisted: ProgrammeDraftSubject[] = []
    for (const [index, subject] of draft.subjects.entries()) {
      let subjectId = subject.id
      const payload = { name: subject.name, slug: `${draft.name}-${subject.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), description: subject.description, programme_id: programmeId, price: 0, currency: 'NGN', is_available_separately: false, sort_order: index }
      const response = await fetch(subjectId ? `${apiUrl}/courses/${subjectId}` : `${apiUrl}/courses`, { method: subjectId ? 'PATCH' : 'POST', headers, body: JSON.stringify(payload) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || `Could not save ${subject.name}`)
      subjectId = subjectId || body.data.id
      const before = new Set(initialSubjects.current.get(subjectId!) || [])
      const after = new Set(subject.tutorIds)
      for (const tutorId of before) if (!after.has(tutorId)) {
        const removal = await fetch(`${apiUrl}/courses/${subjectId}/tutors/${tutorId}`, { method: 'DELETE', headers })
        if (!removal.ok) throw new Error(`Could not update tutors for ${subject.name}`)
      }
      for (const tutorId of after) if (!before.has(tutorId)) {
        const assignment = await fetch(`${apiUrl}/courses/${subjectId}/tutors`, { method: 'POST', headers, body: JSON.stringify({ tutor_id: tutorId }) })
        if (!assignment.ok) throw new Error(`Could not assign a tutor to ${subject.name}`)
      }
      persisted.push({ ...subject, id: subjectId, clientId: subjectId! })
    }
    setDraft(current => ({ ...current, subjects: persisted }))
    initialSubjects.current = new Map(persisted.map(subject => [subject.id!, subject.tutorIds]))
    return { id: programmeId, slug: programmeBody.data.slug, is_published: programmeBody.data.is_published } as SavedProgramme
  }

  async function persist(publish: boolean) {
    if (!detailsReady || !subjectsReady) return toast.error('Complete the programme details and subjects first')
    if (isPaid && !payoutReady) return toast.error('Add a bank account before saving a paid programme', { description: 'Set up where your centre receives payments, then return here.' })
    if (publish && !tutorsReady) return toast.error('Assign at least one tutor to every subject before publishing')
    setSaving(true)
    try {
      let uploadFailed = false
      const accessToken = await token()
      const programme = isEditing ? await updateProgramme(accessToken) : await createProgramme(accessToken)
      setSavedProgramme(programme)
      if (identity) clearProgrammeDraft(identity.school_id, identity.id, programmeId || 'new')
      setDatabaseSaved(true)
      if (coverFile) {
        try { await uploadCover(programme, coverFile) }
        catch (error) {
          uploadFailed = true
          setCoverUploadError(error instanceof Error ? error.message : 'Cover upload failed')
          toast.warning('Programme saved, but the cover image was not uploaded', { description: 'Use Retry cover upload below.' })
        }
      }
      if (publish) {
        const response = await fetch(`${apiUrl}/programmes/${programme.id}/publish`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Programme is not ready to publish')
        setSavedProgramme(current => current ? { ...current, is_published: true } : current)
        toast.success('Programme published')
      } else toast.success('Programme saved as a draft')
      if (!uploadFailed) router.push('/dashboard/programmes')
    } catch (error) {
      toast.error(publish ? 'Could not publish programme' : 'Could not save programme', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    if (!window.confirm('Discard the programme draft saved on this device?')) return
    if (identity) clearProgrammeDraft(identity.school_id, identity.id, programmeId || 'new')
    router.push('/dashboard/programmes')
  }

  if (loading) return <div className="mx-auto max-w-[1440px] rounded-lg border border-[#c2b59b] bg-white p-12 text-center text-sm text-[#474551]">Loading programme setup…</div>

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/programmes" className="inline-flex items-center gap-1 text-sm font-semibold text-[#2e2877]"><span className="material-symbols-outlined text-[18px]">arrow_back</span> Programmes</Link>
          <h1 className="mt-2 text-2xl font-bold text-[#1b1c1c]">{isEditing ? 'Manage programme' : 'Create programme'}</h1>
        </div>
        <div className="text-right">
          {savedAt && <p className="text-xs font-medium text-[#474551]"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-600" />Draft saved on this device</p>}
          {!savedProgramme?.is_published && <button onClick={discard} className="mt-1 text-xs font-semibold text-[#994704] hover:underline">Discard draft</button>}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-[#c8c5d2] bg-white p-3 lg:hidden">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#474551]"><span>Step {step + 1} of 4</span><span>{steps[step].short}</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e4e2e1]"><div className="h-full bg-[#2e2877] transition-all" style={{ width: `${(step + 1) * 25}%` }} /></div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-3 hidden lg:block">
          <ol className="sticky top-6 space-y-2 rounded-lg border border-[#c2b59b] bg-white p-4 shadow-sm">
            {steps.map((item, index) => (
              <li key={item.title}><button onClick={() => index <= step && setStep(index)} className={`flex w-full items-center gap-3 rounded p-3 text-left ${index === step ? 'bg-[#f0efff] text-[#2e2877]' : index < step ? 'text-[#1b1c1c]' : 'text-[#77747e]'}`}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${index <= step ? 'border-[#2e2877] bg-[#2e2877] text-white' : 'border-[#c8c5d2]'}`}>{index < step ? '✓' : index + 1}</span>
                <span className="text-sm font-semibold">{item.title}</span>
              </button></li>
            ))}
          </ol>
        </aside>

        <main className="col-span-12 lg:col-span-9">
          <section className="rounded-lg border border-[#c2b59b] bg-white shadow-sm">
            <header className="border-b border-[#e4e2e1] px-5 py-4 sm:px-7"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#994704]">Step {step + 1}</p><h2 className="mt-1 text-xl font-bold text-[#1b1c1c]">{steps[step].title}</h2></header>
            <div className="p-5 sm:p-7">
              {step === 0 && <DetailsStep draft={draft} coverFile={coverFile} payoutReady={payoutReady} updateDraft={updateDraft} setCoverFile={file => { setCoverFile(file); updateDraft('coverFileName', file?.name) }} />}
              {step === 1 && <SubjectsStep subjects={draft.subjects} onChange={subjects => updateDraft('subjects', subjects)} updateSubject={updateSubject} moveSubject={moveSubject} />}
              {step === 2 && <TutorsStep subjects={draft.subjects} tutors={tutors} selfId={identity?.id || ''} updateSubject={updateSubject} />}
              {step === 3 && <ReviewStep draft={draft} tutors={tutors} detailsReady={detailsReady} subjectsReady={subjectsReady} tutorsReady={tutorsReady} />}

              {coverUploadError && savedProgramme && (
                <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Cover upload needs attention</p><p className="mt-1">{coverUploadError}</p><button disabled={!coverFile || saving} onClick={() => coverFile && uploadCover(savedProgramme, coverFile).then(() => toast.success('Cover uploaded')).catch(error => setCoverUploadError(error.message))} className="mt-3 rounded border border-amber-700 px-3 py-1.5 font-semibold disabled:opacity-50">Retry cover upload</button></div>
              )}
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4e2e1] bg-[#fbf9f8] px-5 py-4 sm:px-7">
              <button disabled={step === 0} onClick={() => setStep(current => Math.max(current - 1, 0))} className="rounded border border-[#c8c5d2] bg-white px-4 py-2 text-sm font-semibold text-[#474551] disabled:opacity-40">Back</button>
              {step < 3 ? <button onClick={nextStep} className="rounded bg-[#2e2877] px-5 py-2 text-sm font-semibold text-white">Continue</button> : <div className="flex flex-wrap gap-2"><button disabled={saving} onClick={() => void persist(false)} className="rounded border border-[#2e2877] bg-white px-4 py-2 text-sm font-semibold text-[#2e2877] disabled:opacity-50">{saving ? 'Saving…' : 'Save as draft'}</button><button disabled={saving || !tutorsReady} onClick={() => void persist(true)} className="rounded bg-[#994704] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Publishing…' : 'Publish programme'}</button></div>}
            </footer>
          </section>
          {savedProgramme && schoolSlug && <div className="mt-4 text-right"><a href={`/${schoolSlug}/${savedProgramme.slug}${savedProgramme.is_published ? '' : `?preview=${savedProgramme.id}`}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#2e2877] hover:underline">Preview programme page</a></div>}
        </main>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) { return <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-[#474551]">{children}</label> }

function DetailsStep({ draft, coverFile, payoutReady, updateDraft, setCoverFile }: { draft: ProgrammeDraftData; coverFile: File | null; payoutReady: boolean | null; updateDraft: <K extends keyof ProgrammeDraftData>(key: K, value: ProgrammeDraftData[K]) => void; setCoverFile: (file: File | null) => void }) {
  return <div className="grid grid-cols-12 gap-5">
    <div className="col-span-12"><FieldLabel>Programme name</FieldLabel><input value={draft.name} onChange={event => updateDraft('name', event.target.value)} placeholder="e.g. JAMB Chemistry" className="w-full rounded border border-[#c8c5d2] px-3.5 py-3 text-sm outline-none focus:border-[#2e2877]" /></div>
    <div className="col-span-12"><FieldLabel>Description</FieldLabel><textarea value={draft.description} onChange={event => updateDraft('description', event.target.value)} rows={4} placeholder="Tell students what they will learn and who this programme is for." className="w-full rounded border border-[#c8c5d2] px-3.5 py-3 text-sm outline-none focus:border-[#2e2877]" /></div>
    <div className="col-span-12 md:col-span-5"><FieldLabel>Programme fee (NGN)</FieldLabel><div className="flex rounded border border-[#c8c5d2] focus-within:border-[#2e2877]"><span className="border-r border-[#c8c5d2] bg-[#f5f3f2] px-3 py-3 text-sm">₦</span><input type="number" min="0" disabled={draft.price.trim() === '0'} value={draft.price} onChange={event => updateDraft('price', event.target.value)} className="min-w-0 flex-1 rounded-r px-3 py-3 text-sm outline-none disabled:bg-[#f5f3f2]" /></div><label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[#474551]"><input type="checkbox" checked={draft.price.trim() === '0'} onChange={event => updateDraft('price', event.target.checked ? '0' : '')} className="h-4 w-4 accent-[#2e2877]" />Offer this programme for free</label><p className="mt-1 text-xs leading-5 text-[#787582]">Free programmes show “Enrol for free” to students and do not open payment checkout.</p>{Number(draft.price) > 0 && <p className={`mt-3 text-xs leading-5 ${payoutReady ? 'text-green-700' : 'text-amber-800'}`}>{payoutReady ? 'Your payout bank account is ready.' : <>Add your payout bank account before you can save this paid programme. <Link href="/dashboard/payments" className="font-semibold underline">Set up bank account</Link></>}</p>}</div>
    <div className="col-span-12 md:col-span-7"><FieldLabel>Cover image (optional)</FieldLabel><label className="flex cursor-pointer items-center gap-3 rounded border border-dashed border-[#c2b59b] bg-[#fbf9f8] p-3 text-sm text-[#474551]"><span className="material-symbols-outlined text-[#2e2877]">add_photo_alternate</span><span>{coverFile?.name || draft.coverFileName || 'Choose a JPG, PNG or WebP image'}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => setCoverFile(event.target.files?.[0] || null)} /></label>{draft.coverFileName && !coverFile && <p className="mt-2 text-xs text-amber-700">Select this image again before saving; files are kept only for this browser session.</p>}</div>
  </div>
}

function SubjectsStep({ subjects, onChange, updateSubject, moveSubject }: { subjects: ProgrammeDraftSubject[]; onChange: (subjects: ProgrammeDraftSubject[]) => void; updateSubject: (id: string, changes: Partial<ProgrammeDraftSubject>) => void; moveSubject: (index: number, offset: number) => void }) {
  return <div><div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-[#474551]">Add the teaching units included in this programme.</p><button onClick={() => onChange([...subjects, newSubject()])} className="inline-flex items-center gap-1 rounded border border-[#2e2877] px-3 py-2 text-sm font-semibold text-[#2e2877]"><span className="material-symbols-outlined text-[18px]">add</span> Add subject</button></div>
    {subjects.length === 0 ? <div className="rounded-lg border border-dashed border-[#c2b59b] p-10 text-center text-sm text-[#474551]">No subjects yet. Add at least one to continue.</div> : <div className="space-y-3">{subjects.map((subject, index) => <div key={subject.clientId} className="grid grid-cols-12 gap-3 rounded-lg border border-[#c8c5d2] p-4">
      <div className="col-span-12 md:col-span-4"><FieldLabel>Subject name</FieldLabel><input value={subject.name} onChange={event => updateSubject(subject.clientId, { name: event.target.value })} placeholder="e.g. Chemistry" className="w-full rounded border border-[#c8c5d2] px-3 py-2.5 text-sm outline-none focus:border-[#2e2877]" /></div>
      <div className="col-span-12 md:col-span-6"><FieldLabel>Short description</FieldLabel><input value={subject.description} onChange={event => updateSubject(subject.clientId, { description: event.target.value })} placeholder="Optional" className="w-full rounded border border-[#c8c5d2] px-3 py-2.5 text-sm outline-none focus:border-[#2e2877]" /></div>
      <div className="col-span-12 flex items-end justify-end gap-1 md:col-span-2"><button aria-label="Move subject up" disabled={index === 0} onClick={() => moveSubject(index, -1)} className="rounded border border-[#c8c5d2] p-2 disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">arrow_upward</span></button><button aria-label="Move subject down" disabled={index === subjects.length - 1} onClick={() => moveSubject(index, 1)} className="rounded border border-[#c8c5d2] p-2 disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">arrow_downward</span></button><button aria-label="Remove subject" onClick={() => onChange(subjects.filter(item => item.clientId !== subject.clientId))} className="rounded border border-red-200 p-2 text-red-700"><span className="material-symbols-outlined text-[18px]">delete</span></button></div>
    </div>)}</div>}
  </div>
}

function TutorsStep({ subjects, tutors, selfId, updateSubject }: { subjects: ProgrammeDraftSubject[]; tutors: Tutor[]; selfId: string; updateSubject: (id: string, changes: Partial<ProgrammeDraftSubject>) => void }) {
  return <div className="space-y-4"><p className="text-sm text-[#474551]">Tutor assignments can be completed later for a draft, but every subject needs one before publishing.</p>{subjects.map(subject => <div key={subject.clientId} className="rounded-lg border border-[#c8c5d2] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-[#1b1c1c]">{subject.name}</h3><button onClick={() => updateSubject(subject.clientId, { tutorIds: subject.tutorIds.includes(selfId) ? subject.tutorIds : [...subject.tutorIds, selfId] })} className="text-xs font-semibold text-[#2e2877] hover:underline">I will teach this subject</button></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{tutors.map(tutor => { const checked = subject.tutorIds.includes(tutor.id); const name = [tutor.first_name, tutor.last_name].filter(Boolean).join(' ') || tutor.email || 'Tutor'; return <label key={tutor.id} className={`flex cursor-pointer items-center gap-3 rounded border p-3 text-sm ${checked ? 'border-[#2e2877] bg-[#f0efff]' : 'border-[#e4e2e1]'}`}><input type="checkbox" checked={checked} onChange={() => updateSubject(subject.clientId, { tutorIds: checked ? subject.tutorIds.filter(id => id !== tutor.id) : [...subject.tutorIds, tutor.id] })} /><span><strong>{name}</strong>{tutor.id === selfId && <span className="ml-1 text-xs text-[#474551]">(you)</span>}</span></label>})}</div>{tutors.length === 0 && <p className="mt-3 rounded bg-[#f5f3f2] p-3 text-sm text-[#474551]">Invite a tutor from the Tutors page, or assign yourself.</p>}</div>)}</div>
}

function ReviewStep({ draft, tutors, detailsReady, subjectsReady, tutorsReady }: { draft: ProgrammeDraftData; tutors: Tutor[]; detailsReady: boolean; subjectsReady: boolean; tutorsReady: boolean }) {
  const names = new Map(tutors.map(tutor => [tutor.id, [tutor.first_name, tutor.last_name].filter(Boolean).join(' ') || tutor.email || 'Tutor']))
  return <div className="grid grid-cols-12 gap-5"><div className="col-span-12 rounded-lg border border-[#c8c5d2] bg-[#fbf9f8] p-5 md:col-span-8"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#994704]">Student-facing summary</p><h3 className="mt-2 text-2xl font-bold text-[#1b1c1c]">{draft.name || 'Untitled programme'}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#474551]">{draft.description || 'No description added.'}</p><p className="mt-4 text-xl font-bold text-[#1b1c1c]">{Number(draft.price || 0) === 0 ? 'Free' : `₦${Number(draft.price).toLocaleString()}`}</p><h4 className="mt-6 text-sm font-bold text-[#1b1c1c]">Subjects included</h4><div className="mt-2 space-y-2">{draft.subjects.map(subject => <div key={subject.clientId} className="rounded border border-[#e4e2e1] bg-white p-3"><p className="font-semibold text-[#1b1c1c]">{subject.name}</p><p className="mt-1 text-xs text-[#474551]">{subject.tutorIds.length ? subject.tutorIds.map(id => names.get(id)).filter(Boolean).join(', ') : 'Tutor not assigned'}</p></div>)}</div></div>
    <aside className="col-span-12 rounded-lg border border-[#c8c5d2] p-5 md:col-span-4"><h3 className="font-bold text-[#1b1c1c]">Completeness</h3><ul className="mt-4 space-y-3 text-sm"><Check ready={detailsReady}>Programme details</Check><Check ready={subjectsReady}>At least one subject</Check><Check ready={tutorsReady}>Tutors assigned</Check></ul>{!tutorsReady && <p className="mt-4 text-xs leading-5 text-[#474551]">You can save this as a draft now. Assign tutors before publishing.</p>}</aside>
  </div>
}

function Check({ ready, children }: { ready: boolean; children: React.ReactNode }) { return <li className="flex items-center gap-2"><span className={`material-symbols-outlined text-[19px] ${ready ? 'text-green-700' : 'text-[#77747e]'}`}>{ready ? 'check_circle' : 'radio_button_unchecked'}</span><span>{children}</span></li> }
