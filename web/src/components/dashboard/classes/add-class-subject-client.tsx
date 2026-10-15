'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { authenticatedApiFetch } from '@/lib/authenticated-fetch'
import { useDashboardSession, dashboardQueryKeys } from '@/lib/dashboard-session'
import { startNavigationProgress } from '@/components/navigation/NavigationProgress'

type Tutor = { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; role: string }

export function AddClassSubjectClient({ classId }: { classId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const session = useDashboardSession()
  const api = process.env.NEXT_PUBLIC_API_URL
  const [className, setClassName] = useState('this class')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tutorId, setTutorId] = useState('')
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const capabilities = session.data?.capabilities
  const independent = capabilities?.organisationType === 'independent'

  useEffect(() => {
    if (!session.data || !api) return
    if (!session.data.capabilities.isAdmin) {
      router.replace(`/dashboard/classes/${classId}`)
      return
    }
    let active = true
    Promise.all([
      authenticatedApiFetch(`${api}/classes/${classId}`),
      independent ? Promise.resolve(null) : authenticatedApiFetch(`${api}/users?roles=admin,tutor`),
    ]).then(async ([classResponse, tutorResponse]) => {
      const classBody = await classResponse.json().catch(() => null)
      if (!classResponse.ok) throw new Error(classBody?.error || 'Could not load this class')
      const tutorBody = tutorResponse ? await tutorResponse.json().catch(() => null) : null
      if (tutorResponse && !tutorResponse.ok) throw new Error(tutorBody?.error || 'Could not load tutors')
      if (!active) return
      setClassName(classBody.data?.name || 'this class')
      setTutors((tutorBody?.data || []).filter((person: Tutor) => person.role === 'admin' || person.role === 'tutor'))
    }).catch(error => toast.error('Could not prepare subject setup', { description: error instanceof Error ? error.message : 'Try again.' }))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api, classId, independent, router, session.data])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || saving || !api) return
    setSaving(true)
    try {
      const response = await authenticatedApiFetch(`${api}/classes/${classId}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), tutor_ids: tutorId ? [tutorId] : [] }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Could not add this subject')
      const subjectId = body?.data?.subject?.id
      toast.success('Subject added')
      startNavigationProgress()
      router.push(`/dashboard/classes/${classId}${subjectId ? `?subject=${subjectId}` : ''}`)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['class-workspace', classId] }),
        queryClient.invalidateQueries({ queryKey: ['programmes'] }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.schedule }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.summary }),
      ])
    } catch (error) {
      toast.error('Could not add subject', { description: error instanceof Error ? error.message : 'Try again.' })
    } finally {
      setSaving(false)
    }
  }

  if (session.isPending || loading) return <div className="mx-auto max-w-2xl rounded-2xl border border-dashboard-outline bg-white p-10 text-center text-sm text-dashboard-muted">Preparing subject setup…</div>

  return <main className="mx-auto w-full max-w-2xl">
    <Link href={`/dashboard/classes/${classId}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#514b5b]"><ArrowLeft size={17}/> Back to {className}</Link>
    <form onSubmit={submit} className="mt-5 overflow-hidden rounded-2xl border border-dashboard-outline bg-white shadow-dashboard-card">
      <header className="border-b border-dashboard-outline px-5 py-5 sm:px-7"><p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">{className}</p><h1 className="mt-2 text-2xl font-bold text-[#180d62]">Add subject</h1><p className="mt-2 text-sm text-dashboard-muted">Create one teaching subject inside this class.</p></header>
      <div className="space-y-5 p-5 sm:p-7">
        <label className="block text-sm font-bold text-[#27242d]">Subject name<input autoFocus value={name} onChange={event => setName(event.target.value)} disabled={saving} placeholder="e.g. Physics" className="mt-2 min-h-12 w-full rounded-xl border border-[#beb8c5] px-4 font-normal outline-none focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10" /></label>
        <label className="block text-sm font-bold text-[#27242d]">Description <span className="font-normal text-dashboard-muted">(optional)</span><textarea value={description} onChange={event => setDescription(event.target.value)} disabled={saving} rows={4} className="mt-2 w-full rounded-xl border border-[#beb8c5] px-4 py-3 font-normal outline-none focus:border-[#312783] focus:ring-4 focus:ring-[#312783]/10" /></label>
        {!independent ? <label className="block text-sm font-bold text-[#27242d]">Tutor <span className="font-normal text-dashboard-muted">(optional)</span><select value={tutorId} onChange={event => setTutorId(event.target.value)} disabled={saving} className="mt-2 min-h-12 w-full rounded-xl border border-[#beb8c5] bg-white px-4 font-normal"><option value="">Assign later</option>{tutors.map(tutor => <option key={tutor.id} value={tutor.id}>{[tutor.first_name, tutor.last_name].filter(Boolean).join(' ') || tutor.email || 'Unnamed tutor'}</option>)}</select></label> : <p className="rounded-xl bg-[#f8f7ff] p-4 text-sm text-[#514b5b]">You will be assigned to this subject automatically.</p>}
      </div>
      <footer className="flex flex-col-reverse gap-2 border-t border-dashboard-outline bg-[#fbf9f8] p-5 sm:flex-row sm:justify-end"><Link href={`/dashboard/classes/${classId}`} className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-bold text-[#514b5b]">Cancel</Link><button disabled={saving || !name.trim()} className="min-h-11 rounded-lg bg-[#312783] px-5 text-sm font-bold text-white disabled:opacity-45">{saving ? 'Adding…' : 'Add subject'}</button></footer>
    </form>
  </main>
}
