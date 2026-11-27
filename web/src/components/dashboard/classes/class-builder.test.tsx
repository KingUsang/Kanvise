import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassBuilder } from './class-builder'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedApiFetch: fetchMock }))
vi.mock('@/lib/account-preference', () => ({ useActiveAccountId: () => 'account-1' }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/components/navigation/NavigationProgress', () => ({ startNavigationProgress: vi.fn() }))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function route(overrides: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (url: string) => {
    const path = String(url)
    for (const [fragment, make] of Object.entries(overrides)) if (path.includes(fragment)) return make()
    if (path.includes('/auth/me')) return json({ user: { id: 'u1', role: 'admin' } })
    if (path.includes('/users')) return json({ data: [{ id: 'u1', role: 'admin', first_name: 'Ada' }] })
    if (path.includes('/schools/me')) return json({ data: { account_type: 'centre' } })
    if (path.includes('/payments/summary')) return json({ data: { subaccount: { subaccount_code: 'ACCT' } } })
    return json({}, 404)
  })
}

function renderBuilder() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><ClassBuilder /></QueryClientProvider>)
}

beforeEach(() => fetchMock.mockReset())

describe('ClassBuilder prerequisites (DEV-FE-038)', () => {
  it('shows a retryable error, not an unusable form, when a prerequisite fails, and recovers on retry', async () => {
    let failTutors = true
    route({ '/users': () => failTutors ? json({ error: 'down' }, 500) : json({ data: [{ id: 'u1', role: 'admin', first_name: 'Ada' }] }) })
    renderBuilder()
    expect(await screen.findByText('We could not load the class prerequisites')).toBeInTheDocument()
    failTutors = false
    fireEvent.click(screen.getByRole('button', { name: /try again|retry/i }))
    await waitFor(() => expect(screen.queryByText('We could not load the class prerequisites')).not.toBeInTheDocument())
  })

  it('does not treat a payout lookup failure as missing payout setup', async () => {
    route({ '/payments/summary': () => json({ error: 'down' }, 503) })
    renderBuilder()
    await waitFor(() => expect(screen.queryByText('Preparing class setup…')).not.toBeInTheDocument())
    expect(screen.queryByText('We could not load the class prerequisites')).not.toBeInTheDocument()
    expect(screen.queryByText(/Set up your payout account/)).not.toBeInTheDocument()
  })
})
