import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TutorsClient } from './tutors-client'
import { clearActiveAccountId, setActiveAccountId } from '@/lib/account-preference'

const { authenticatedApiFetch } = vi.hoisted(() => ({ authenticatedApiFetch: vi.fn() }))

vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedApiFetch }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

function renderTutors() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><TutorsClient /></QueryClientProvider>)
}

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
})
