'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authenticatedApiFetch } from '@/lib/authenticated-fetch'
import { useActiveAccountId } from '@/lib/account-preference'
import { classQueryKeys } from '@/lib/class-query-keys'
import { loadProgrammeDraft } from '@/lib/programme-draft'
import { PageHeader } from '@/components/dashboard/page-header'
import { Button, LinkButton } from '@/components/dashboard/action-controls'
import { EmptyState, ErrorState, PageLoadingState, RefreshNotice } from '@/components/dashboard/async-states'
import { Plus, School, SearchX } from 'lucide-react'
import { readApiBody, responseErrorMessage, safeApiErrorMessage } from '@/lib/safe-api-error'

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

const ACTIVE_ENROLMENT_MESSAGE = 'This programme has enrolled students, so it cannot be deleted. Unpublish it instead to remove it from the student page.'

export function ProgrammesClient() {
  const queryClient = useQueryClient()
  const accountId = useActiveAccountId()
  const searchParams = useSearchParams()
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>(() => {
    const value = searchParams.get('status')
    return value === 'published' || value === 'draft' ? value : 'all'
  })

  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      setSearch(params.get('search') || '')
      const status = params.get('status')
      setStatusFilter(status === 'published' || status === 'draft' ? status : 'all')
    }
    window.addEventListener('popstate', syncFromUrl)
    return () => window.removeEventListener('popstate', syncFromUrl)
  }, [])

  useEffect(() => {
    const status = searchParams.get('status')
    setSearch(searchParams.get('search') || '')
    setStatusFilter(status === 'published' || status === 'draft' ? status : 'all')
  }, [searchParams])

  const updateFilters = (nextSearch: string, nextStatus: 'all' | 'published' | 'draft') => {
    const url = new URL(window.location.href)
    if (nextSearch.trim()) url.searchParams.set('search', nextSearch)
    else url.searchParams.delete('search')
    if (nextStatus === 'all') url.searchParams.delete('status')
    else url.searchParams.set('status', nextStatus)
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
    setSearch(nextSearch)
    setStatusFilter(nextStatus)
  }

  const programmesQuery = useQuery({
    queryKey: classQueryKeys.programmes(accountId),
    queryFn: async ({ signal }) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      const [programmesResponse, schoolResponse, profileResponse] = await Promise.all([
        authenticatedApiFetch(`${apiUrl}/classes`, { signal }),
        authenticatedApiFetch(`${apiUrl}/schools/me`, { signal }),
        authenticatedApiFetch(`${apiUrl}/auth/me`, { signal }),
      ])
      if (!programmesResponse.ok || !profileResponse.ok) throw new Error('Could not load class data')
      const [{ data }, schoolBody, { user }] = await Promise.all([
        programmesResponse.json(), schoolResponse.ok ? schoolResponse.json() : Promise.resolve({}), profileResponse.json(),
      ])
      const school = schoolResponse.ok ? schoolBody.data : null
      return { programmes: (data || []) as Programme[], schoolSlug: school?.slug || '', schoolId: school?.id as string | undefined, userId: user?.id as string | undefined, canCreate: user?.role === 'admin', schoolContextError: !schoolResponse.ok }
    },
    staleTime: 60_000,
  })
  const programmes = programmesQuery.data?.programmes || []
  const schoolSlug = programmesQuery.data?.schoolSlug || ''
  const schoolContextError = programmesQuery.data?.schoolContextError || false
  const hasLocalDraft = Boolean(programmesQuery.data?.schoolId && programmesQuery.data?.userId && loadProgrammeDraft(programmesQuery.data.schoolId, programmesQuery.data.userId))
  const canCreate = programmesQuery.data?.canCreate ?? false
  const loadError = programmesQuery.error && !programmesQuery.data ? 'We could not load your classes. Check your connection and try again.' : ''
  const refreshError = Boolean(programmesQuery.error && programmesQuery.data)
  const visibleProgrammes = programmes.filter((programme) => {
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'published' ? programme.is_published : !programme.is_published)
    const needle = search.trim().toLowerCase()
    const matchesSearch = !needle || `${programme.name} ${programme.courses.map(subject => subject.name).join(' ')}`.toLowerCase().includes(needle)
    return matchesStatus && matchesSearch
  })

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
    let safePublishMessage = ''
    try {
      const response = await authenticatedApiFetch(`${process.env.NEXT_PUBLIC_API_URL}/classes/${programme.id}/publish`, {
        method: 'POST',
      })
      const body = await readApiBody<{ readiness?: { missing_tutors?: Subject[] } }>(response)
      if (!response.ok) {
        const missing = body?.readiness?.missing_tutors?.map(subject => subject.name).join(', ')
        safePublishMessage = missing ? `Assign tutors to: ${missing}` : ''
        throw new Error(safePublishMessage || responseErrorMessage(response, 'Please review the class setup.'))
      }
      toast.success('Class published')
      await queryClient.invalidateQueries({ queryKey: classQueryKeys.programmes(accountId) })
    } catch (error) {
      toast.error('Class is not ready', { description: safeApiErrorMessage(error, 'Please review its setup.', safePublishMessage ? [safePublishMessage] : []) })
    } finally {
      setPublishingId(null)
    }
  }

  const deleteProgramme = async (programme: Programme) => {
    if (!window.confirm(`Delete “${programme.name}”? This removes its subjects and cannot be undone.`)) return
    setDeletingId(programme.id)
    try {
      const response = await authenticatedApiFetch(`${process.env.NEXT_PUBLIC_API_URL}/classes/${programme.id}`, {
        method: 'DELETE',
      })
      const body = await readApiBody<{ code?: string }>(response)
      if (!response.ok) throw new Error(body?.code === 'ACTIVE_ENROLMENTS_EXIST'
        ? ACTIVE_ENROLMENT_MESSAGE
        : responseErrorMessage(response, 'Could not delete programme'))
      toast.success('Class deleted')
      await queryClient.invalidateQueries({ queryKey: classQueryKeys.programmes(accountId) })
    } catch (error) {
      toast.error('Could not delete programme', { description: safeApiErrorMessage(error, 'Please try again.', [ACTIVE_ENROLMENT_MESSAGE]) })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Classes"
        description="Create the teaching groups where your subjects, learners and sessions live."
        actions={canCreate ? <LinkButton href="/dashboard/classes/new" variant="primary" fullWidthMobile>
          <Plus aria-hidden="true" size={18} /> Create class
        </LinkButton> : null}
      />

      {hasLocalDraft && (
        <div className="flex flex-col gap-3 rounded-lg border border-[#2e2877]/25 bg-[#f0efff] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#2e2877]">draft</span>
            <div><p className="font-semibold text-[#1b1c1c]">Continue setup</p><p className="text-sm text-[#474551]">A class draft is saved on this device.</p></div>
          </div>
          <Link href="/dashboard/classes/new" className="text-sm font-semibold text-[#2e2877] hover:underline">Open draft</Link>
        </div>
      )}

      {refreshError && (
        <RefreshNotice message="Class refresh failed; showing your last saved classes." onRetry={() => void programmesQuery.refetch()} />
      )}

      {schoolContextError && !loadError && (
        <RefreshNotice message="Class links are temporarily unavailable because centre details could not be loaded." onRetry={() => void programmesQuery.refetch()} />
      )}

      {programmesQuery.isSuccess && programmes.length > 0 && <section className="rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface p-3 shadow-dashboard-card sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-4">
        <label className="relative block min-w-0 flex-1"><span className="sr-only">Search classes</span><span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-[#766f78]">search</span><input value={search} onChange={(event) => updateFilters(event.target.value, statusFilter)} placeholder="Search classes or subjects" className="min-h-11 w-full rounded-lg border border-[#d8d3d0] bg-white py-2 pl-10 pr-3 text-sm text-[#27242d] outline-none transition focus:border-[#2e2877]" /></label>
        <div className="mt-3 flex gap-2 overflow-x-auto sm:mt-0">{([{ id: 'all', label: `All (${programmes.length})` }, { id: 'published', label: `Active (${programmes.filter(item => item.is_published).length})` }, { id: 'draft', label: `Draft (${programmes.filter(item => !item.is_published).length})` }] as const).map(filter => <button type="button" key={filter.id} onClick={() => updateFilters(search, filter.id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${statusFilter === filter.id ? 'bg-[#2e2877] text-white' : 'border border-[#d8d3d0] bg-white text-[#625e69] hover:border-[#2e2877]/40'}`}>{filter.label}</button>)}</div>
      </section>}

      {programmesQuery.isLoading ? (
        <PageLoadingState label="Loading classes" />
      ) : programmesQuery.isError && !programmesQuery.data ? (
        <ErrorState message="We could not load your classes." onRetry={() => void programmesQuery.refetch()} />
      ) : programmesQuery.isSuccess && programmes.length === 0 ? (
        <EmptyState
          icon={<School aria-hidden="true" size={24} />}
          title="Create your first class"
          body="Add the subjects, learners and sessions you will teach together."
          action={canCreate ? <LinkButton href="/dashboard/classes/new" variant="primary" fullWidthMobile>Create class</LinkButton> : <p className="text-sm text-dashboard-muted">Your centre admin creates classes and assigns you the subjects you teach.</p>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visibleProgrammes.map(programme => (
            <article key={programme.id} className="overflow-hidden rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card">
              <div className="flex gap-4 p-5">
                <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded border border-[#c8c5d2] bg-[#f2ebd9]">
                  {programme.thumbnail_url ? <img src={programme.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <span className="material-symbols-outlined text-3xl text-[#994704]">menu_book</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="truncate text-lg font-bold text-[#1b1c1c]">{programme.name}</h2>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${programme.is_published ? 'border-[#994704]/20 bg-[#994704]/10 text-[#994704]' : 'border-[#c8c5d2] bg-[#f5f3f2] text-[#474551]'}`}>{programme.is_published ? 'Published' : 'Draft'}</span>
                  </div>
                  <p className="mt-2 text-xl font-bold text-[#1b1c1c]">{Number(programme.price) === 0 ? 'Free' : `₦${Number(programme.price).toLocaleString()}`}</p>
                  <p className="mt-1 text-xs text-[#474551]">{programme.courses_count} {programme.courses_count === 1 ? 'subject' : 'subjects'} · {programme.tutors_complete ? 'Tutors assigned' : `${programme.assigned_subjects_count}/${programme.courses_count} with tutors`}</p>
                </div>
              </div>
              <div className="border-y border-[#e4e2e1] bg-[#fbf9f8] px-5 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#474551]">Subjects</p>
                {programme.courses.length ? <div className="flex flex-wrap gap-2">{programme.courses.map(subject => <span key={subject.id} className="rounded border border-[#c8c5d2] bg-white px-2.5 py-1 text-xs font-medium text-[#1b1c1c]">{subject.name}</span>)}</div> : <p className="text-sm text-[#474551]">No subjects added yet.</p>}
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                <Link href={programme.courses_count ? `/dashboard/classes/${programme.id}` : `/dashboard/classes/new`} className="rounded bg-[#2e2877] px-3.5 py-2 text-xs font-semibold text-white">{programme.courses_count ? 'Open class' : 'Continue setup'}</Link>
                {schoolSlug && <a href={`/${schoolSlug}/${programme.slug}${programme.is_published ? '' : `?preview=${programme.id}`}`} target="_blank" rel="noreferrer" className="rounded border border-[#c8c5d2] px-3.5 py-2 text-xs font-semibold text-[#474551]">Preview enrolment page</a>}
                {schoolSlug && <button onClick={() => void copyLink(programme)} className="rounded border border-[#c8c5d2] px-3.5 py-2 text-xs font-semibold text-[#474551]">Copy enrolment link</button>}
                {canCreate && !programme.is_published && <button disabled={publishingId === programme.id} onClick={() => void publish(programme)} className="ml-auto rounded border border-[#994704] px-3.5 py-2 text-xs font-semibold text-[#994704] disabled:opacity-50">{publishingId === programme.id ? 'Publishing…' : 'Publish'}</button>}
                {canCreate && <button disabled={deletingId === programme.id} onClick={() => void deleteProgramme(programme)} className={`${programme.is_published ? '' : 'ml-auto'} rounded border border-[#ba1a1a]/40 px-3.5 py-2 text-xs font-semibold text-[#ba1a1a] disabled:opacity-50`}>{deletingId === programme.id ? 'Deleting…' : 'Delete'}</button>}
              </div>
            </article>
          ))}
          {!visibleProgrammes.length && <div className="col-span-full"><EmptyState icon={<SearchX aria-hidden="true" size={24} />} title="No classes match" body="Try another name, subject, or status filter." action={<Button variant="quiet" onClick={() => updateFilters('', 'all')}>Clear filters</Button>} /></div>}
        </div>
      )}
    </div>
  )
}
