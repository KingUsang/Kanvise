import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TutorsClient } from './tutors-client'
import { clearActiveAccountId, setActiveAccountId } from '@/lib/account-preference'
import { peopleQueryKeys } from '@/lib/people-query-keys'

const { authenticatedApiFetch } = vi.hoisted(() => ({ authenticatedApiFetch: vi.fn() }))

vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedApiFetch }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const accountId = '11111111-1111-4111-8111-111111111111'

function renderTutors(seed: { tutors?: unknown; invites?: unknown; people?: unknown; assignments?: unknown } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const keys = peopleQueryKeys(accountId)
  if (seed.tutors !== undefined) queryClient.setQueryData(keys.tutors, seed.tutors, { updatedAt: 0 })
  if (seed.invites !== undefined) queryClient.setQueryData(keys.invites, seed.invites, { updatedAt: 0 })
  if (seed.people !== undefined) queryClient.setQueryData(keys.people, seed.people, { updatedAt: 0 })
  if (seed.assignments !== undefined) queryClient.setQueryData(keys.assignments, seed.assignments, { updatedAt: 0 })
  return render(<QueryClientProvider client={queryClient}><TutorsClient /></QueryClientProvider>)
}

afterEach(() => vi.unstubAllEnvs())

describe('TutorsClient independent panel recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearActiveAccountId()
    setActiveAccountId('11111111-1111-4111-8111-111111111111')
  })

  it('does not turn an invitation dependency failure into a false empty state', async () => {
    authenticatedApiFetch.mockImplementation((input: string) => {
      if (input.includes('/schools/me/invites')) return Promise.resolve(new Response(JSON.stringify({ error: 'Invitations unavailable' }), { status: 503 }))
      if (input.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ user: { id: 'admin-1' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    renderTutors()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('We could not load invitations. Please try again.'))
    expect(screen.queryByText('No outstanding invitations.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('retains cached Tutors and shows a polite refresh notice after a failed refetch', async () => {
    authenticatedApiFetch.mockImplementation((input: string) => {
      if (input.includes('/users/tutors')) return Promise.resolve(new Response(JSON.stringify({ error: 'Tutors unavailable' }), { status: 503 }))
      if (input.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ user: { id: 'admin-1' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    renderTutors({ tutors: [{ id: 'tutor-1', first_name: 'Ada', last_name: 'Tutor', email: 'ada@example.test', courses: [] }] })

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Tutor list could not refresh. Showing the last saved list.'))
    expect(screen.getAllByText('Ada Tutor')).toHaveLength(2)
    expect(screen.getByRole('status').querySelector('button')).toHaveTextContent('Try again')
  })

  it('retains cached invitations and shows a polite refresh notice after a failed refetch', async () => {
    authenticatedApiFetch.mockImplementation((input: string) => {
      if (input.includes('/schools/me/invites')) return Promise.resolve(new Response(JSON.stringify({ error: 'Invitations unavailable' }), { status: 503 }))
      if (input.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ user: { id: 'admin-1' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    renderTutors({ invites: [{ id: 'invite-1', email: 'pending@example.test', status: 'pending', expires_at: '2026-12-01T00:00:00.000Z', created_at: '2026-11-01T00:00:00.000Z' }] })

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Invitations could not refresh. Showing the last saved list.'))
    expect(screen.getByText('pending@example.test')).toBeInTheDocument()
    expect(screen.queryByText('No outstanding invitations.')).not.toBeInTheDocument()
  })

  it('retains cached Subject assignments and people after dependency refetch failures', async () => {
    authenticatedApiFetch.mockImplementation((input: string) => {
      if (input.includes('/courses/assignment-overview') || input.includes('/users?roles=admin,tutor')) {
        return Promise.resolve(new Response(JSON.stringify({ error: 'Assignments unavailable' }), { status: 503 }))
      }
      if (input.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ user: { id: 'admin-1' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    renderTutors({
      people: [{ id: 'tutor-1', first_name: 'Ada', last_name: 'Tutor', email: 'ada@example.test', role: 'tutor' }],
      assignments: [{ id: 'course-1', name: 'Mathematics', is_published: true, tutors: [] }],
    })

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Subject assignments could not refresh. Showing the last saved assignments.'))
    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Tutor choices could not refresh. Showing the last saved people list.')
  })
})
