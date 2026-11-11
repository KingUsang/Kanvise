import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SchoolSetupRouteClient } from './school-setup-route-client'

const mocks = vi.hoisted(() => ({
  authenticatedApiFetch: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedApiFetch: mocks.authenticatedApiFetch }))
vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.kanvise.test' }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }))

function renderRoute(mode: 'setup' | 'settings' = 'setup', retry: number | boolean = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry } } })
  return render(<QueryClientProvider client={queryClient}><SchoolSetupRouteClient mode={mode} /></QueryClientProvider>)
}

describe('dashboard school data boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the configured school through the authenticated query client', async () => {
    mocks.authenticatedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'school-1', name: 'Bright Future', slug: 'bright-future', is_active: true } }), { status: 200 }))

    renderRoute()

    expect(screen.getByText('Loading your centre details…')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Centre profile' })).toBeInTheDocument())
    expect(mocks.authenticatedApiFetch).toHaveBeenCalledWith(expect.stringContaining('/schools/me'), expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }))
  })

  it('keeps first-time setup available when Hono reports no configured school', async () => {
    mocks.authenticatedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'User does not belong to a school' }), { status: 400 }))

    renderRoute()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Name your centre' })).toBeInTheDocument())
  })

  it('shows a safe retry state for service failures', async () => {
    mocks.authenticatedApiFetch.mockRejectedValue(new Error('internal transport details'))

    renderRoute()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument())
    expect(screen.getByText('We could not load your centre details. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText('internal transport details')).not.toBeInTheDocument()
  })

  it('does not retry session expiry and offers safe sign-in continuation', async () => {
    mocks.authenticatedApiFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'Your session has ended. Please sign in again.', code: 'SESSION_EXPIRED' }), { status: 401 }))

    renderRoute('setup', 1)

    await waitFor(() => expect(screen.getByText('Your session has ended. Please sign in again.')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Centre profile' })).not.toBeInTheDocument()
    expect(mocks.authenticatedApiFetch).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(mocks.replace).toHaveBeenCalledWith('/auth/login?redirect=%2Fdashboard%2Fschool-setup')
  })

  it('does not retry forbidden responses under the production retry policy', async () => {
    mocks.authenticatedApiFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'Insufficient role' }), { status: 403 }))

    renderRoute('setup', 1)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument())
    expect(mocks.authenticatedApiFetch).toHaveBeenCalledTimes(1)
  })

  it('redirects settings to first-time setup only for the typed missing-school state', async () => {
    mocks.authenticatedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'SCHOOL_NOT_CONFIGURED' }), { status: 400 }))

    renderRoute('settings')

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/dashboard/school-setup'))
  })
})
