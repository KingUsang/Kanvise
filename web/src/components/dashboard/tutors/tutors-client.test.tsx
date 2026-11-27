import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('announces initial Tutor-list failures in the responsive list', async () => {
    authenticatedApiFetch.mockImplementation((input: string) => {
      if (input.includes('/users/tutors')) return Promise.resolve(new Response(JSON.stringify({ error: 'Tutors unavailable' }), { status: 503 }))
      if (input.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ user: { id: 'admin-1' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    renderTutors()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    expect(alert).toHaveTextContent('We could not load the Tutor list. Please try again.')
  })

  it('announces invitation action failures as assertive errors', async () => {
    authenticatedApiFetch.mockImplementation((input: string) => {
      if (input.includes('/schools/me/invite/tutor')) return Promise.resolve(new Response(JSON.stringify({ error: 'Invitation unavailable' }), { status: 503 }))
      if (input.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ user: { id: 'admin-1' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    renderTutors()
    fireEvent.change(screen.getByPlaceholderText('tutor@example.com'), { target: { value: 'tutor@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: /Send invitation/ }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    expect(alert).toHaveTextContent('Invitation unavailable')
  })

  it('retains cached Tutors and shows a polite refresh notice after a failed refetch', async () => {
    authenticatedApiFetch.mockImplementation((input: string) => {
      if (input.includes('/users/tutors')) return Promise.resolve(new Response(JSON.stringify({ error: 'Tutors unavailable' }), { status: 503 }))
      if (input.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ user: { id: 'admin-1' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    renderTutors({ tutors: [{ id: 'tutor-1', first_name: 'Ada', last_name: 'Tutor', email: 'ada@example.test', courses: [] }] })

    await waitFor(() => expect(screen.getAllByRole('status').some((status) => status.textContent?.includes('Tutor list could not refresh. Showing the last saved list.'))).toBe(true))
    expect(screen.getAllByText('Ada Tutor')).toHaveLength(1)
    const refreshNotice = screen.getAllByRole('status').find((status) => status.textContent?.includes('Tutor list could not refresh'))
    expect(refreshNotice?.querySelector('button')).toHaveTextContent('Try again')
  })

  it('retains cached invitations and shows a polite refresh notice after a failed refetch', async () => {
    authenticatedApiFetch.mockImplementation((input: string) => {
      if (input.includes('/schools/me/invites')) return Promise.resolve(new Response(JSON.stringify({ error: 'Invitations unavailable' }), { status: 503 }))
      if (input.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ user: { id: 'admin-1' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    renderTutors({ invites: [{ id: 'invite-1', email: 'pending@example.test', status: 'pending', expires_at: '2026-12-01T00:00:00.000Z', created_at: '2026-11-01T00:00:00.000Z' }] })

    await waitFor(() => expect(screen.getAllByRole('status').some((status) => status.textContent?.includes('Invitations could not refresh. Showing the last saved list.'))).toBe(true))
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

    await waitFor(() => expect(screen.getAllByRole('status').some((status) => status.textContent?.includes('Subject assignments could not refresh. Showing the last saved assignments.'))).toBe(true))
    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getAllByRole('status').some((status) => status.textContent?.includes('Tutor choices could not refresh. Showing the last saved people list.'))).toBe(true)
  })

  it('uses the canonical Tutor toolbar for search, filters, counts and invitation focus', async () => {
    authenticatedApiFetch.mockImplementation((input: string) => {
      if (input.includes('/users/tutors')) return Promise.resolve(new Response(JSON.stringify({ data: [
        { id: 'tutor-1', first_name: 'Ada', last_name: 'Tutor', email: 'ada@example.test', courses: [{ id: 'subject-1', name: 'Mathematics' }] },
        { id: 'tutor-2', first_name: 'Grace', last_name: 'Tutor', email: 'grace@example.test', courses: [] },
      ] }), { status: 200 }))
      if (input.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ user: { id: 'admin-1' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    renderTutors()

    const toolbar = await screen.findByRole('toolbar', { name: 'Tutor collection controls' })
    await screen.findByText('Ada Tutor')
    expect(screen.getByRole('searchbox', { name: 'Search Tutors' })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: 'Invite Tutor' })).toHaveClass('min-h-11')
    expect(toolbar).toHaveTextContent('2 Tutors')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Tutors' }), { target: { value: 'Ada' } })
    expect(screen.getByText('Ada Tutor')).toBeInTheDocument()
    expect(screen.queryByText('Grace Tutor')).not.toBeInTheDocument()
    expect(toolbar).toHaveTextContent('1 of 2 Tutors')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Tutors' }), { target: { value: '' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter Tutors' }), { target: { value: 'assigned' } })
    expect(screen.getByText('Ada Tutor')).toBeInTheDocument()
    expect(screen.queryByText('Grace Tutor')).not.toBeInTheDocument()
  })

  it('keeps assigned-Tutor removal controls at the canonical target size', async () => {
    authenticatedApiFetch.mockImplementation((input: string) => {
      if (input.includes('/courses/assignment-overview')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'course-1', name: 'Mathematics', is_published: true, tutors: [{ id: 'tutor-1', first_name: 'Ada', last_name: 'Tutor', email: 'ada@example.test', role: 'tutor' }] }] }), { status: 200 }))
      if (input.includes('/users?roles=admin,tutor')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'tutor-1', first_name: 'Ada', last_name: 'Tutor', email: 'ada@example.test', role: 'tutor' }] }), { status: 200 }))
      if (input.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ user: { id: 'admin-1' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    renderTutors()

    const removeButton = await screen.findByRole('button', { name: 'Remove Ada from Mathematics' })
    expect(removeButton).toHaveClass('h-11', 'min-h-11', 'w-11', 'focus-visible:outline-2')
  })

  it('follows invitation and people pages past the first 50 and 200 rows', async () => {
    const invite = (id: string) => ({ id, email: `${id}@example.test`, status: 'pending', expires_at: '2099-12-01T00:00:00.000Z', created_at: '2026-11-01T00:00:00.000Z' })
    const page = (url: string, rows: unknown[][], hasMore: boolean[]) => {
      const offset = Number(new URL(url, 'https://x.test').searchParams.get('offset'))
      const index = offset === 0 ? 0 : 1
      return Promise.resolve(new Response(JSON.stringify({ data: rows[index], pagination: { has_more: hasMore[index] } }), { status: 200 }))
    }
    authenticatedApiFetch.mockImplementation((input: string) => {
      if (input.includes('/schools/me/invites')) return page(input, [[invite('first')], [invite('second')]], [true, false])
      if (input.includes('/users?roles=admin,tutor')) return page(input, [[], []], [true, false])
      if (input.includes('/auth/me')) return Promise.resolve(new Response(JSON.stringify({ user: { id: 'admin-1' } }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    })

    renderTutors()

    expect(await screen.findByText('second@example.test')).toBeInTheDocument()
    expect(screen.getByText('first@example.test')).toBeInTheDocument()
    const urls = authenticatedApiFetch.mock.calls.map(([url]) => String(url))
    expect(urls.some((u) => u.includes('/schools/me/invites?limit=50&offset=50'))).toBe(true)
    expect(urls.some((u) => u.includes('/users?roles=admin,tutor&limit=200&offset=200'))).toBe(true)
  })
})
