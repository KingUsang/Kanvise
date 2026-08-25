'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { loadProgrammeDraft } from '@/lib/programme-draft'

type Subject = { id: string; name: string; tutor_ids: string[] }
type Programme = {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  thumbnail_url?: string | null
  is_published: boolean
  courses: Subject[]
  courses_count: number
  assigned_subjects_count: number
  tutors_complete: boolean
}

export function ProgrammesClient() {
  const supabase = useMemo(() => createClient(), [])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [schoolSlug, setSchoolSlug] = useState('')
  const [hasLocalDraft, setHasLocalDraft] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      const [programmesResponse, schoolResponse, profileResponse] = await Promise.all([
        fetch(`${apiUrl}/programmes`, { headers }),
        fetch(`${apiUrl}/schools/me`, { headers }),
        fetch(`${apiUrl}/auth/me`, { headers }),
      ])
      if (!programmesResponse.ok || !schoolResponse.ok || !profileResponse.ok) throw new Error('Could not load programme data')
      const [{ data }, { data: school }, { user }] = await Promise.all([
        programmesResponse.json(), schoolResponse.json(), profileResponse.json(),
      ])
      setProgrammes(data || [])
      setSchoolSlug(school?.slug || '')
      if (school?.id && user?.id) setHasLocalDraft(Boolean(loadProgrammeDraft(school.id, user.id)))
    } catch (error) {
      console.error(error)
      setLoadError('We could not load your programmes. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const copyLink = async (programme: Programme) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${schoolSlug}/${programme.slug}`)
      toast.success('Enrolment link copied')
    } catch {
      toast.error('Could not copy the enrolment link')
    }
  }

  const publish = async (programme: Programme) => {
    setPublishingId(programme.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/programmes/${programme.id}/publish`, {
        method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const body = await response.json()
      if (!response.ok) {
        const missing = body.readiness?.missing_tutors?.map((subject: Subject) => subject.name).join(', ')
        throw new Error(missing ? `Assign tutors to: ${missing}` : body.error)
      }
      toast.success('Programme published')
      await load()
    } catch (error) {
      toast.error('Programme is not ready', { description: error instanceof Error ? error.message : 'Please review its setup.' })
    } finally {
      setPublishingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#474551]">What you teach</p>
          <h1 className="mt-2 text-3xl font-bold text-[#1b1c1c]">Programmes</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#474551]">Create enrolment packages and organise the subjects students receive.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {schoolSlug && (
            <a href={`/${schoolSlug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded border border-[#c8c5d2] bg-white px-4 py-2.5 text-sm font-semibold text-[#474551] hover:bg-[#f5f3f2]">
              <span className="material-symbols-outlined text-[19px]">storefront</span> Preview centre page
            </a>
          )}
          <Link href="/dashboard/programmes/new" className="inline-flex items-center gap-2 rounded bg-[#994704] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#753400]">
            <span className="material-symbols-outlined text-[19px]">add</span> Create programme
          </Link>
        </div>
      </header>

      {hasLocalDraft && (
        <div className="flex flex-col gap-3 rounded-lg border border-[#2e2877]/25 bg-[#f0efff] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#2e2877]">draft</span>
            <div><p className="font-semibold text-[#1b1c1c]">Continue setup</p><p className="text-sm text-[#474551]">A programme draft is saved on this device.</p></div>
          </div>
          <Link href="/dashboard/programmes/new" className="text-sm font-semibold text-[#2e2877] hover:underline">Open draft</Link>
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError} <button onClick={() => void load()} className="ml-2 font-semibold underline">Try again</button></div>
      )}

      {loading ? (
        <div className="rounded-lg border border-[#c2b59b] bg-white p-12 text-center text-sm text-[#474551]">Loading programmes…</div>
      ) : programmes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#c2b59b] bg-white px-6 py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-[#2e2877]">school</span>
          <h2 className="mt-3 text-xl font-bold text-[#1b1c1c]">Create your first programme</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#474551]">Bundle at least one subject into a programme students can enrol in.</p>
          <Link href="/dashboard/programmes/new" className="mt-5 inline-flex rounded bg-[#994704] px-5 py-2.5 text-sm font-semibold text-white">Create programme</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {programmes.map(programme => (
            <article key={programme.id} className="overflow-hidden rounded-lg border border-[#c2b59b] bg-white shadow-sm">
              <div className="flex gap-4 p-5">
                <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded border border-[#c8c5d2] bg-[#f2ebd9]">
                  {programme.thumbnail_url ? <img src={programme.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <span className="material-symbols-outlined text-3xl text-[#994704]">menu_book</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="truncate text-lg font-bold text-[#1b1c1c]">{programme.name}</h2>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${programme.is_published ? 'border-[#994704]/20 bg-[#994704]/10 text-[#994704]' : 'border-[#c8c5d2] bg-[#f5f3f2] text-[#474551]'}`}>{programme.is_published ? 'Published' : 'Draft'}</span>
                  </div>
                  <p className="mt-2 text-xl font-bold text-[#1b1c1c]">₦{Number(programme.price).toLocaleString()}</p>
                  <p className="mt-1 text-xs text-[#474551]">{programme.courses_count} {programme.courses_count === 1 ? 'subject' : 'subjects'} · {programme.tutors_complete ? 'Tutors assigned' : `${programme.assigned_subjects_count}/${programme.courses_count} with tutors`}</p>
                </div>
              </div>
              <div className="border-y border-[#e4e2e1] bg-[#fbf9f8] px-5 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#474551]">Subjects</p>
                {programme.courses.length ? <div className="flex flex-wrap gap-2">{programme.courses.map(subject => <span key={subject.id} className="rounded border border-[#c8c5d2] bg-white px-2.5 py-1 text-xs font-medium text-[#1b1c1c]">{subject.name}</span>)}</div> : <p className="text-sm text-[#474551]">No subjects added yet.</p>}
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                <Link href={`/dashboard/programmes/${programme.id}`} className="rounded bg-[#2e2877] px-3.5 py-2 text-xs font-semibold text-white">{programme.courses_count ? 'Manage' : 'Continue setup'}</Link>
                {schoolSlug && <a href={`/${schoolSlug}/${programme.slug}`} target="_blank" rel="noreferrer" className="rounded border border-[#c8c5d2] px-3.5 py-2 text-xs font-semibold text-[#474551]">Preview programme page</a>}
                {schoolSlug && <button onClick={() => void copyLink(programme)} className="rounded border border-[#c8c5d2] px-3.5 py-2 text-xs font-semibold text-[#474551]">Copy enrolment link</button>}
                {!programme.is_published && <button disabled={publishingId === programme.id} onClick={() => void publish(programme)} className="ml-auto rounded border border-[#994704] px-3.5 py-2 text-xs font-semibold text-[#994704] disabled:opacity-50">{publishingId === programme.id ? 'Publishing…' : 'Publish'}</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
