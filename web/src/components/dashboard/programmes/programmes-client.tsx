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
import { actionControlClassName, Button, LinkButton } from '@/components/dashboard/action-controls'
import { EmptyState, ErrorState, PageLoadingState, RefreshNotice } from '@/components/dashboard/async-states'
import { CollectionToolbar } from '@/components/dashboard/collection-controls'
import { School, SearchX } from 'lucide-react'
import { readApiBody, responseErrorMessage, safeApiErrorMessage } from '@/lib/safe-api-error'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

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

type StatusFilter = 'all' | 'published' | 'draft'

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Active' },
  { value: 'draft', label: 'Draft' },
] as const

const ACTIVE_ENROLMENT_MESSAGE = 'This class has enrolled learners, so it cannot be deleted. Unpublish it instead to remove it from the learner page.'

export function ProgrammesClient() {
  const queryClient = useQueryClient()
  const accountId = useActiveAccountId()
  const searchParams = useSearchParams()
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
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

  const updateFilters = (nextSearch: string, nextStatus: StatusFilter) => {
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
    if (await copyToClipboard(`${window.location.origin}/${schoolSlug}/${programme.slug}`)) toast.success('Enrolment link copied')
    else toast.error('Could not copy the enrolment link')
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
        : responseErrorMessage(response, 'Could not delete class'))
      toast.success('Class deleted')
      await queryClient.invalidateQueries({ queryKey: classQueryKeys.programmes(accountId) })
    } catch (error) {
      toast.error('Could not delete class', { description: safeApiErrorMessage(error, 'Please try again.', [ACTIVE_ENROLMENT_MESSAGE]) })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Classes"
        description="Create the teaching groups where your subjects, learners and sessions live."
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
        <RefreshNotice message="Class links are temporarily unavailable because tutoring account details could not be loaded." onRetry={() => void programmesQuery.refetch()} />
      )}

      {programmesQuery.isSuccess && programmes.length > 0 && (
        <CollectionToolbar
          ariaLabel="Class collection controls"
          searchLabel="Search classes"
          searchPlaceholder="Search classes or subjects"
          searchValue={search}
          onSearchChange={(value) => updateFilters(value, statusFilter)}
          filterLabel="Filter classes by status"
          filterValue={statusFilter}
          filterOptions={STATUS_FILTERS}
          onFilterChange={(value) => updateFilters(search, value)}
          resultCount={visibleProgrammes.length}
          totalCount={programmes.length}
          itemLabel="class"
          itemPluralLabel="classes"
          action={canCreate ? <LinkButton href="/dashboard/classes/new" variant="primary" fullWidthMobile>Create class</LinkButton> : null}
        />
      )}

      {programmesQuery.isLoading ? (
        <PageLoadingState label="Loading classes" />
      ) : programmesQuery.isError && !programmesQuery.data ? (
        <ErrorState message="We could not load your classes." onRetry={() => void programmesQuery.refetch()} />
      ) : programmesQuery.isSuccess && programmes.length === 0 ? (
        <EmptyState
          icon={<School aria-hidden="true" size={24} />}
          title={canCreate ? 'Create your first class' : 'No classes assigned yet'}
          body={canCreate ? 'Add the subjects, learners and sessions you will teach together.' : 'Your tutoring account Admin creates classes and assigns you the subjects you teach.'}
          action={canCreate ? <LinkButton href="/dashboard/classes/new" variant="primary" fullWidthMobile>Create class</LinkButton> : undefined}
        />
      ) : visibleProgrammes.length ? (
        <ul aria-label="Classes" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visibleProgrammes.map(programme => (
            <li key={programme.id}>
              <article className="h-full overflow-hidden rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card">
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
                <LinkButton href={programme.courses_count ? `/dashboard/classes/${programme.id}` : `/dashboard/classes/new`} variant="primary">{programme.courses_count ? 'Open class' : 'Continue setup'}</LinkButton>
                {schoolSlug && <a href={`/${schoolSlug}/${programme.slug}${programme.is_published ? '' : `?preview=${programme.id}`}`} target="_blank" rel="noreferrer" className={actionControlClassName({ variant: 'secondary' })}>Preview enrolment page</a>}
                {schoolSlug && programme.is_published && <Button variant="secondary" onClick={() => void copyLink(programme)}>Copy enrolment link</Button>}
                {canCreate && !programme.is_published && <Button variant="secondary" pending={publishingId === programme.id} pendingLabel="Publishing…" onClick={() => void publish(programme)} className="sm:ml-auto">Publish</Button>}
                {canCreate && <Button variant="danger" pending={deletingId === programme.id} pendingLabel="Deleting…" onClick={() => void deleteProgramme(programme)} className={programme.is_published ? '' : 'sm:ml-auto'}>Delete</Button>}
              </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<SearchX aria-hidden="true" size={24} />} title="No classes match" body="Try another name, subject, or status filter." action={<Button variant="quiet" onClick={() => updateFilters('', 'all')}>Clear filters</Button>} />
      )}
    </div>
  )
}
