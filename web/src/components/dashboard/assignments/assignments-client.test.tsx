import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssignmentsClient } from './assignments-client'

const { authenticatedApiFetch } = vi.hoisted(() => ({ authenticatedApiFetch: vi.fn() }))

vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedApiFetch }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/components/navigation/NavigationProgress', () => ({ startNavigationProgress: vi.fn() }))

function renderAssignments() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><AssignmentsClient /></QueryClientProvider>)
}

describe('AssignmentsClient request and query boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps an initial API failure visible and offers retry', async () => {
    authenticatedApiFetch.mockResolvedValueOnce(new Response(null, { status: 401 }))
    renderAssignments()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Your session has ended. Please sign in again.'))
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(authenticatedApiFetch).toHaveBeenCalled()
    expect(authenticatedApiFetch.mock.calls[0]?.[1]).toBeUndefined()
  })
})
