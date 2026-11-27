'use client'

import { useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Clock3, Copy, Mail, School, Trash2, UserPlus, Users, X } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { Button, IconButton } from '@/components/dashboard/action-controls'
import { CollectionToolbar, type CollectionFilterOption } from '@/components/dashboard/collection-controls'
import { Dialog } from '@/components/dashboard/dialog'
import { EmptyState, ErrorState, PageLoadingState, RefreshNotice, SectionLoadingState } from '@/components/dashboard/async-states'
import { Field, fieldControlClassName, fieldDescribedBy } from '@/components/dashboard/form-fields'
import { dashboardQueryKeys } from '@/lib/dashboard-session'
import { authenticatedApiFetch } from '@/lib/authenticated-fetch'
import { useActiveAccountId } from '@/lib/account-preference'
import { peopleQueryKeys } from '@/lib/people-query-keys'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

interface Tutor {
  id: string
  kanvise_user_id: string
  first_name: string
  last_name: string
  email: string
  bio: string | null
  profile_photo_key: string | null
  role: string
  courses: { id: string; name: string }[]
}

interface Invite {
  id: string
  email: string
  status: string
  expires_at: string
  created_at: string
}

interface AssignmentPerson {
  id: string
  kanvise_user_id: string
  first_name: string
  last_name: string
  email: string
  role: string
}

interface CourseAssignmentOverview {
  id: string
  name: string
  is_published: boolean
  tutors: AssignmentPerson[]
}

type ApiBody<T = unknown> = { data?: T; user?: { id?: string }; error?: string }
type TutorFilter = 'all' | 'assigned' | 'unassigned'
type Confirmation =
  | { type: 'revoke'; id: string; email: string }
  | { type: 'remove'; id: string; name: string }

const tutorFilterOptions: readonly CollectionFilterOption<TutorFilter>[] = [
  { value: 'all', label: 'All Tutors' },
  { value: 'assigned', label: 'With Subjects' },
  { value: 'unassigned', label: 'No Subjects' },
]

function initialsFor(tutor: Tutor) {
  return `${tutor.first_name[0] || ''}${tutor.last_name[0] || ''}`.toUpperCase()
}

function formatDate(value: string, includeYear = true) {
  return new Date(value).toLocaleDateString('en-GB', includeYear
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' })
}

async function readApiResponse<T = unknown>(url: string, init?: RequestInit) {
  const response = await authenticatedApiFetch(url, init)
  const body = await response.json().catch(() => null) as ApiBody<T> | null
  if (!response.ok) throw new Error(body?.error || 'Could not load this panel')
  return body || {}
}

/** Follows limit/offset pages so invitation (50 per page) and people (200 per page) lists are never cut off. */
function readAllApiData<T>(url: string, limit: number) {
  const separator = url.includes('?') ? '&' : '?'
  return fetchAllPages<T>(
    (page) => authenticatedApiFetch(`${url}${separator}limit=${limit}&offset=${(page - 1) * limit}`),
    'Could not load this panel',
  )
}

async function readApiData<T>(url: string) {
  const body = await readApiResponse<T>(url)
  return (body.data || []) as T
}

function TutorCard({ tutor, isRemoving, onRemove }: { tutor: Tutor; isRemoving: boolean; onRemove: () => void }) {
  return (
    <article role="listitem" className={`flex items-start gap-3 border-b border-dashboard-outline/50 p-4 last:border-b-0 sm:p-5 ${isRemoving ? 'opacity-40' : ''}`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-dashboard-control border border-dashboard-outline bg-dashboard-primary/10 font-bold text-dashboard-primary">
        {initialsFor(tutor)}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-bold text-dashboard-foreground">{tutor.first_name} {tutor.last_name}</h2>
        <p className="truncate text-sm text-dashboard-muted">{tutor.email}</p>
        <p className="mt-2 text-sm text-dashboard-muted">
          {tutor.courses.length ? tutor.courses.map((course) => course.name).join(', ') : 'No assigned Subjects'}
        </p>
      </div>
      <IconButton
        type="button"
        variant="danger"
        label={`Remove ${tutor.first_name} ${tutor.last_name}`}
        onClick={onRemove}
        disabled={isRemoving}
      >
        <Trash2 aria-hidden="true" size={18} />
      </IconButton>
    </article>
  )
}

function AssignmentRow({
  course,
  assignmentPeople,
  currentProfileId,
  updatingCourseId,
  onUpdate,
}: {
  course: CourseAssignmentOverview
  assignmentPeople: AssignmentPerson[]
  currentProfileId: string | null
  updatingCourseId: string | null
  onUpdate: (person: AssignmentPerson, isAssigned: boolean) => void
}) {
  const availablePeople = assignmentPeople.filter((person) => !course.tutors.some((tutor) => tutor.id === person.id))
  const isUpdating = updatingCourseId === course.id

  return (
    <li className="border-b border-dashboard-outline/50 p-5 last:border-b-0">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-dashboard-foreground">{course.name}</p>
            {course.tutors.length === 0 ? <span className="rounded-full border border-dashboard-danger/30 bg-dashboard-danger/10 px-2 py-1 text-[10px] font-bold uppercase text-dashboard-danger">No Tutor</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {course.tutors.map((person) => (
              <span key={person.id} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashboard-outline bg-dashboard-surface-subtle py-1 pl-3 pr-1 text-xs text-dashboard-muted">
                {person.first_name} {person.last_name}{person.id === currentProfileId ? ' (you)' : ''}
                <IconButton
                  type="button"
                  variant="quiet"
                  label={`Remove ${person.first_name} from ${course.name}`}
                  disabled={isUpdating}
                  onClick={() => onUpdate(person, true)}
                >
                  <X aria-hidden="true" size={15} />
                </IconButton>
              </span>
            ))}
          </div>
        </div>
        <label className="flex min-w-48 flex-col gap-1 text-xs font-semibold text-dashboard-muted">
          <span>Assign a Tutor</span>
          <select
            aria-label={`Assign a Tutor to ${course.name}`}
            value=""
            disabled={isUpdating || availablePeople.length === 0}
            onChange={(event) => {
              const person = assignmentPeople.find((item) => item.id === event.target.value)
              if (person) onUpdate(person, false)
            }}
            className={`${fieldControlClassName} mt-0 bg-dashboard-surface`}
          >
            <option value="">{availablePeople.length === 0 ? 'Everyone assigned' : 'Add a Tutor…'}</option>
            {availablePeople.map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}{person.id === currentProfileId ? ' (you)' : ''}</option>)}
          </select>
        </label>
      </div>
    </li>
  )
}

export function TutorsClient() {
  const accountId = useActiveAccountId()
  const queryClient = useQueryClient()
  const inviteInputRef = useRef<HTMLInputElement>(null)
  const [updatingCourseId, setUpdatingCourseId] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [tutorSearch, setTutorSearch] = useState('')
  const [tutorFilter, setTutorFilter] = useState<TutorFilter>('all')
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const baseUrl = process.env.NEXT_PUBLIC_API_URL
  const keys = peopleQueryKeys(accountId)
  const enabled = Boolean(accountId)
  const tutorsQuery = useQuery({ queryKey: keys.tutors, queryFn: () => readAllApiData<Tutor>(`${baseUrl}/users/tutors`, 200), enabled, staleTime: 60_000 })
  const invitesQuery = useQuery({ queryKey: keys.invites, queryFn: () => readAllApiData<Invite>(`${baseUrl}/schools/me/invites`, 50), enabled, staleTime: 60_000 })
  const peopleQuery = useQuery({ queryKey: keys.people, queryFn: () => readAllApiData<AssignmentPerson>(`${baseUrl}/users?roles=admin,tutor`, 200), enabled, staleTime: 60_000 })
  const assignmentsQuery = useQuery({ queryKey: keys.assignments, queryFn: () => readApiData<CourseAssignmentOverview[]>(`${baseUrl}/courses/assignment-overview`), enabled, staleTime: 60_000 })
  const profileQuery = useQuery({ queryKey: keys.profile, queryFn: async () => (await readApiResponse(`${baseUrl}/auth/me`)).user?.id || null, enabled, staleTime: 60_000 })

  const tutors = tutorsQuery.data || []
  const invites = invitesQuery.data || []
  const assignmentPeople = peopleQuery.data || []
  const courseAssignments = assignmentsQuery.data || []
  const currentProfileId = profileQuery.data || null
  const tutorSearchValue = tutorSearch.trim().toLowerCase()
  const filteredTutors = tutors.filter((tutor) => {
    const matchesSearch = !tutorSearchValue || `${tutor.first_name} ${tutor.last_name} ${tutor.email}`.toLowerCase().includes(tutorSearchValue)
    const matchesFilter = tutorFilter === 'all' || (tutorFilter === 'assigned' ? tutor.courses.length > 0 : tutor.courses.length === 0)
    return matchesSearch && matchesFilter
  })
  const isLoading = enabled && tutorsQuery.isPending
  const loadError = !accountId ? 'Select a tutoring account to view its people.' : tutorsQuery.isError && !tutorsQuery.data ? 'We could not load the Tutor list. Please try again.' : ''
  const tutorsRefreshError = accountId && tutorsQuery.isError && tutorsQuery.data ? 'The Tutor list could not refresh. Showing the last saved list.' : ''
  const pendingInvites = invites.filter((invite) => invite.status === 'pending')
  const expiredInvites = invites.filter((invite) => invite.status === 'expired')
  const activeInvites = [...pendingInvites, ...expiredInvites].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const invitesLoading = enabled && invitesQuery.isPending
  const invitesError = !accountId ? 'Select a tutoring account to view invitations.' : invitesQuery.isError && !invitesQuery.data ? 'We could not load invitations. Please try again.' : ''
  const invitesRefreshError = accountId && invitesQuery.isError && invitesQuery.data ? 'Invitations could not refresh. Showing the last saved list.' : ''
  const assignmentsLoading = enabled && (assignmentsQuery.isPending || peopleQuery.isPending)
  const assignmentsError = !accountId ? 'Select a tutoring account to view Subject assignments.' : (assignmentsQuery.isError && !assignmentsQuery.data) || (peopleQuery.isError && !peopleQuery.data) ? 'We could not load Subject assignments. Please try again.' : ''
  const assignmentsRefreshMessages = [
    assignmentsQuery.isError && assignmentsQuery.data ? 'Subject assignments could not refresh. Showing the last saved assignments.' : '',
    peopleQuery.isError && peopleQuery.data ? 'Tutor choices could not refresh. Showing the last saved people list.' : '',
  ].filter(Boolean)

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsInviting(true)
    setInviteError('')
    setGeneratedLink('')
    try {
      const response = await authenticatedApiFetch(`${baseUrl}/schools/me/invite/tutor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Failed to generate invite link')
      setGeneratedLink(json.data.invite_url)
      setInviteEmail('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.root }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.capabilities }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.summary }),
      ])
      toast.success(json.data.email_sent ? 'Invitation emailed to the Tutor' : 'Invitation link created', { description: json.data.email_sent ? 'They can use the email to join your tutoring account.' : 'The email could not be sent. Copy and share the link yourself.' })
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Could not send the invitation. Please try again.')
    } finally {
      setIsInviting(false)
    }
  }

  const handleResend = async (email: string, id: string) => {
    setResendingId(id)
    try {
      const response = await authenticatedApiFetch(`${baseUrl}/schools/me/invite/tutor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Failed to resend invite link')
      setGeneratedLink(json.data.invite_url)
      setInviteError('')
      await queryClient.invalidateQueries({ queryKey: keys.root })
      toast.success('Invitation resent')
    } catch (error) {
      toast.error('Could not resend the invitation', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setResendingId(null)
    }
  }

  const handleCopy = async () => {
    if (await copyToClipboard(generatedLink)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } else {
      toast.error('Could not copy the invitation link. Select it and copy manually.')
    }
  }

  const handleRevoke = async (inviteId: string) => {
    setRevokingId(inviteId)
    try {
      const response = await authenticatedApiFetch(`${baseUrl}/schools/me/invites/${inviteId}/revoke`, { method: 'POST' })
      if (!response.ok) {
        const json = await response.json().catch(() => ({}))
        toast.error('Could not revoke the invitation', { description: json.error || 'Please try again.' })
      } else {
        await queryClient.invalidateQueries({ queryKey: keys.root })
        toast.success('Invitation revoked')
      }
    } catch {
      toast.error('Could not revoke the invitation', { description: 'The result could not be confirmed. The list has been refreshed, so check it before trying again.' })
      await queryClient.invalidateQueries({ queryKey: keys.root }).catch(() => undefined)
    } finally {
      setRevokingId(null)
    }
  }

  const handleRemoveTutor = async (tutorId: string) => {
    setRemovingId(tutorId)
    try {
      const response = await authenticatedApiFetch(`${baseUrl}/users/${tutorId}`, { method: 'DELETE' })
      if (!response.ok) {
        const json = await response.json().catch(() => ({}))
        toast.error('Could not remove the Tutor', { description: json.error || 'Please try again.' })
      } else {
        await queryClient.invalidateQueries({ queryKey: keys.root })
        toast.success('Tutor removed')
      }
    } catch {
      toast.error('Could not remove the Tutor', { description: 'The result could not be confirmed. The list has been refreshed, so check it before trying again.' })
      await queryClient.invalidateQueries({ queryKey: keys.root }).catch(() => undefined)
    } finally {
      setRemovingId(null)
    }
  }

  const updateCourseAssignment = async (courseId: string, person: AssignmentPerson, isAssigned: boolean) => {
    setUpdatingCourseId(courseId)
    try {
      const response = await authenticatedApiFetch(isAssigned ? `${baseUrl}/courses/${courseId}/tutors/${person.id}` : `${baseUrl}/courses/${courseId}/tutors`, {
        method: isAssigned ? 'DELETE' : 'POST',
        headers: isAssigned ? {} : { 'Content-Type': 'application/json' },
        ...(isAssigned ? {} : { body: JSON.stringify({ tutor_id: person.id }) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Could not update the Subject assignment')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.root }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.capabilities }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.summary }),
      ])
      toast.success(isAssigned ? 'Tutor removed from Subject' : 'Tutor assigned to Subject')
    } catch (error) {
      toast.error('Could not update the Subject assignment', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setUpdatingCourseId(null)
    }
  }

  const confirmationBusy = confirmation?.type === 'remove' ? removingId === confirmation.id : confirmation?.type === 'revoke' ? revokingId === confirmation.id : false

  return (
    <div className="space-y-8">
      <DashboardPageHeader title="Tutors" description="Invite Tutors to your tutoring account and see the Subjects assigned to each person. If you teach alone, you do not need to invite yourself." />

      <CollectionToolbar
        ariaLabel="Tutor collection controls"
        searchLabel="Search Tutors"
        searchPlaceholder="Search by name or email"
        searchValue={tutorSearch}
        onSearchChange={setTutorSearch}
        filterLabel="Filter Tutors"
        filterValue={tutorFilter}
        filterOptions={tutorFilterOptions}
        onFilterChange={setTutorFilter}
        resultCount={filteredTutors.length}
        totalCount={tutors.length}
        itemLabel="Tutor"
        itemPluralLabel="Tutors"
        action={<Button type="button" variant="primary" fullWidthMobile onClick={() => inviteInputRef.current?.focus()}><UserPlus aria-hidden="true" size={17} /> Invite Tutor</Button>}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <section className="overflow-hidden rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card" aria-labelledby="tutor-list-heading">
            <header className="flex items-center gap-3 border-b border-dashboard-outline bg-dashboard-surface-subtle px-5 py-5 sm:px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-dashboard-control bg-dashboard-primary/10 text-dashboard-primary"><Users aria-hidden="true" size={20} /></div>
              <div>
                <h2 id="tutor-list-heading" className="text-lg font-bold text-dashboard-foreground">Tutors in your tutoring account</h2>
                <p className="mt-1 text-sm text-dashboard-muted">Manage access and see assigned Subjects.</p>
              </div>
            </header>
            {tutorsRefreshError ? <RefreshNotice message={tutorsRefreshError} onRetry={() => void tutorsQuery.refetch()} /> : null}
            {isLoading ? <PageLoadingState label="Loading Tutors" /> : loadError ? <ErrorState message={loadError} onRetry={() => void tutorsQuery.refetch()} /> : tutors.length === 0 ? (
              <EmptyState icon={<Users aria-hidden="true" size={22} />} title="No Tutors yet" body="You are currently teaching on your own. Invite someone when another Tutor needs access to teach Subjects in your tutoring account." />
            ) : filteredTutors.length === 0 ? (
              <EmptyState icon={<Users aria-hidden="true" size={22} />} title="No Tutors match" body="Try a different search or clear the filter to see every Tutor." action={<Button type="button" variant="quiet" onClick={() => { setTutorSearch(''); setTutorFilter('all') }}>Clear filters</Button>} />
            ) : (
              <div role="list" aria-label="Tutors" className="divide-y divide-dashboard-outline/50">
                {filteredTutors.map((tutor) => <TutorCard key={tutor.id} tutor={tutor} isRemoving={removingId === tutor.id} onRemove={() => setConfirmation({ type: 'remove', id: tutor.id, name: `${tutor.first_name} ${tutor.last_name}` })} />)}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card" aria-labelledby="assignment-heading">
            <header className="border-b border-dashboard-outline bg-dashboard-surface-subtle px-5 py-5 sm:px-6">
              <h2 id="assignment-heading" className="text-lg font-bold text-dashboard-foreground">Teaching assignments</h2>
              <p className="mt-1 text-sm leading-6 text-dashboard-muted">Choose who teaches each Subject. A published Subject must always have at least one Tutor.</p>
            </header>
            {assignmentsRefreshMessages.length > 0 ? <RefreshNotice message={assignmentsRefreshMessages.join(' ')} onRetry={() => { void assignmentsQuery.refetch(); void peopleQuery.refetch() }} /> : null}
            {assignmentsLoading ? <SectionLoadingState label="Loading Subject assignments" cards={2} /> : assignmentsError ? <div className="p-5"><ErrorState message={assignmentsError} onRetry={() => { void assignmentsQuery.refetch(); void peopleQuery.refetch() }} size="compact" /></div> : courseAssignments.length === 0 ? (
              <EmptyState icon={<School aria-hidden="true" size={22} />} title="No Subjects to assign" body="Create a Subject before assigning Tutors." />
            ) : (
              <ul aria-label="Teaching assignments">
                {courseAssignments.map((course) => <AssignmentRow key={course.id} course={course} assignmentPeople={assignmentPeople} currentProfileId={currentProfileId} updatingCourseId={updatingCourseId} onUpdate={(person, isAssigned) => void updateCourseAssignment(course.id, person, isAssigned)} />)}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4">
          <section className="rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface p-5 shadow-dashboard-card sm:p-6" aria-labelledby="invite-heading">
            <header className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">People management</p>
              <h2 id="invite-heading" className="mt-1 text-xl font-bold text-dashboard-foreground">Invite a Tutor</h2>
              <p className="mt-1 text-sm leading-6 text-dashboard-muted">Enter an email address. We will email a link to join your tutoring account, and you can copy the link yourself.</p>
            </header>
            <form onSubmit={(event) => void handleInvite(event)} className="flex flex-col gap-4" noValidate>
              <Field id="tutor-invite-email" label="Tutor email" required error={inviteError}>
                <input ref={inviteInputRef} id="tutor-invite-email" type="email" required autoComplete="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="tutor@example.com" disabled={isInviting} aria-invalid={Boolean(inviteError)} aria-describedby={fieldDescribedBy('tutor-invite-email', undefined, inviteError)} className={fieldControlClassName} />
              </Field>
              {generatedLink ? (
                <div role="status" aria-live="polite" className="rounded-dashboard-panel border border-dashboard-success/30 bg-dashboard-success/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-dashboard-success"><CheckCircle2 aria-hidden="true" size={17} /> Invitation link ready</div>
                  <label htmlFor="generated-invitation-link" className="mt-3 block text-xs font-semibold text-dashboard-foreground">Invitation link</label>
                  <div className="mt-2 flex gap-2"><input id="generated-invitation-link" readOnly value={generatedLink} className={`${fieldControlClassName} mt-0 min-w-0 flex-1`} /><Button type="button" variant="secondary" onClick={() => void handleCopy()}><Copy aria-hidden="true" size={16} /> {copied ? 'Copied' : 'Copy'}</Button></div>
                </div>
              ) : null}
              <Button type="submit" variant="primary" pending={isInviting} pendingLabel="Sending invitation…" disabled={!inviteEmail} fullWidthMobile><Mail aria-hidden="true" size={17} /> Send invitation</Button>
            </form>
          </section>

          <section className="overflow-hidden rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card" aria-labelledby="invites-heading">
            <header className="border-b border-dashboard-outline bg-dashboard-surface-subtle px-5 py-4"><h2 id="invites-heading" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-dashboard-foreground"><Clock3 aria-hidden="true" size={17} /> Invitations awaiting response</h2></header>
            {invitesRefreshError ? <RefreshNotice message={invitesRefreshError} onRetry={() => void invitesQuery.refetch()} /> : null}
            {invitesLoading ? <SectionLoadingState label="Loading invitations" cards={2} /> : invitesError ? <div className="p-5"><ErrorState message={invitesError} onRetry={() => void invitesQuery.refetch()} size="compact" /></div> : activeInvites.length === 0 ? (
              <EmptyState icon={<Mail aria-hidden="true" size={22} />} title="No outstanding invitations" body="New Tutor invitations will appear here until they are accepted or expire." />
            ) : (
              <ul aria-label="Tutor invitations" className="divide-y divide-dashboard-outline/50">
                {activeInvites.map((invite) => {
                  const isExpired = invite.status === 'expired'
                  const isRevoking = revokingId === invite.id
                  const isResending = resendingId === invite.id
                  return (
                    <li key={invite.id} className={`flex flex-col gap-3 p-4 ${isExpired ? 'bg-dashboard-surface-subtle' : ''}`}>
                      <div className="flex items-start justify-between gap-3"><p className={`min-w-0 truncate text-sm font-bold text-dashboard-foreground ${isExpired ? 'line-through' : ''}`}>{invite.email}</p><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${isExpired ? 'border-dashboard-danger/30 bg-dashboard-danger/10 text-dashboard-danger' : 'border-dashboard-accent/30 bg-dashboard-accent/10 text-dashboard-accent'}`}>{isExpired ? 'Expired' : 'Pending'}</span></div>
                      <div className="flex items-end justify-between gap-3"><div className="text-xs text-dashboard-muted"><p>Sent: {formatDate(invite.created_at)}</p>{!isExpired ? <p className="mt-1 flex items-center gap-1 text-dashboard-accent"><Clock3 aria-hidden="true" size={13} /> Expires {formatDate(invite.expires_at, false)}</p> : null}</div>{isExpired ? <Button type="button" variant="quiet" pending={isResending} pendingLabel="Sending…" onClick={() => void handleResend(invite.email, invite.id)}>Resend</Button> : <Button type="button" variant="quiet" pending={isRevoking} pendingLabel="Revoking…" onClick={() => setConfirmation({ type: 'revoke', id: invite.id, email: invite.email })}>Revoke</Button>}</div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {confirmation ? (
        <Dialog open onClose={() => { if (!confirmationBusy) setConfirmation(null) }} title={confirmation.type === 'remove' ? 'Remove this Tutor?' : 'Cancel this invitation?'} description={confirmation.type === 'remove' ? `${confirmation.name} will lose access to your tutoring account. Their previous teaching records will be kept.` : `The invitation sent to ${confirmation.email} will stop working.`} busy={confirmationBusy}>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="quiet" data-dialog-initial-focus onClick={() => setConfirmation(null)} disabled={confirmationBusy}>Keep it</Button>
            <Button type="button" variant="danger" pending={Boolean(confirmationBusy)} pendingLabel={confirmation.type === 'remove' ? 'Removing…' : 'Cancelling…'} onClick={() => { const action = confirmation; setConfirmation(null); if (action.type === 'remove') void handleRemoveTutor(action.id); else void handleRevoke(action.id) }}>{confirmation.type === 'remove' ? 'Remove Tutor' : 'Cancel invitation'}</Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}
