import { act, cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  pathname: '/dashboard',
  session: { data: undefined as unknown, isPending: false, isError: false, isSuccess: false, refetch: vi.fn() },
}))

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }))
vi.mock('@/lib/dashboard-session', () => ({ useDashboardSession: () => mocks.session }))
vi.mock('@/components/account/account-switcher', () => ({
  AccountSwitcherError: class extends Error {},
  switchAccountOnServer: vi.fn(),
  useAccountMemberships: () => ({ data: [], selected: null }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) } }),
}))
vi.mock('@/lib/authenticated-fetch', () => ({
  SESSION_ENDED_EVENT: 'kanvise:session-ended',
  authenticatedApiFetch: vi.fn(async () => new Response(JSON.stringify({ data: { count: 0 } }))),
}))

import { DashboardShell } from './shell'

function sessionFor(capabilities: Record<string, unknown>) {
  return {
    data: {
      token: 't',
      capabilities,
      user: { id: 'p-1', first_name: 'Michael', last_name: 'Chen', email: 'michael@example.com', photo_url: null },
      account: { name: 'Science Students Academy', logo_url: null },
    },
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  }
}

function renderShell(role = 'tutor', setupRequired = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DashboardShell user={{ first_name: 'Michael', last_name: 'Chen', role, email: 'michael@example.com' }} setupRequired={setupRequired}>
        <p>Page content</p>
      </DashboardShell>
    </QueryClientProvider>,
  )
}

describe('DashboardShell', () => {
  beforeEach(() => {
    mocks.pathname = '/dashboard'
    mocks.session = sessionFor({ isAdmin: false, isTutor: true, organisationType: 'centre' })
  })
  afterEach(cleanup)

  it('renders the page inside the shell', () => {
    renderShell()
    expect(within(screen.getByRole('main')).getByText('Page content')).toBeInTheDocument()
    expect(screen.getByText('Tutor · Science Students Academy')).toBeInTheDocument()
  })

  it('shows Not available in place for an admin-only page instead of redirecting', () => {
    mocks.pathname = '/dashboard/tutors'
    renderShell()
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('heading', { level: 1 })).toHaveTextContent('This page is for admins')
    expect(main.queryByText('Page content')).toBeNull()
  })

  it('refuses admin pages to a tutor before access has loaded', () => {
    mocks.pathname = '/dashboard/payments'
    mocks.session = { data: undefined, isPending: true, isError: false, isSuccess: false, refetch: vi.fn() }
    renderShell()
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1 })).toHaveTextContent('This page is for admins')
  })

  it('shows the shell error state when access cannot be loaded', () => {
    const refetch = vi.fn()
    mocks.session = { data: undefined, isPending: false, isError: true, isSuccess: false, refetch }
    renderShell()
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('alert')).toHaveTextContent("We couldn't load this.")
    main.getByRole('button', { name: 'Try again' }).click()
    expect(refetch).toHaveBeenCalled()
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument()
  })

  it('keeps the page and asks to sign in again when the sign-in ends', () => {
    mocks.pathname = '/dashboard/classes'
    renderShell()
    act(() => { window.dispatchEvent(new Event('kanvise:session-ended')) })
    const dialog = within(screen.getByRole('alertdialog', { name: "You've been signed out" }))
    expect(dialog.getByRole('link', { name: 'Sign in again' })).toHaveAttribute('href', '/auth/login?redirect=%2Fdashboard%2Fclasses')
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('shows only the setup item to a new agency admin', () => {
    mocks.pathname = '/dashboard/school-setup'
    renderShell('admin', true)
    const sidebar = within(screen.getByRole('complementary', { name: 'Sidebar' }))
    expect(sidebar.getAllByRole('link').filter((link) => link.getAttribute('href') !== '/dashboard').map((link) => link.textContent)).toEqual(['Set up tutoring agency'])
    const bar = within(screen.getByRole('navigation', { name: 'Bottom bar' }))
    expect(bar.getAllByRole('link').map((link) => link.textContent)).toEqual(['Set up tutoring agency'])
  })
})
