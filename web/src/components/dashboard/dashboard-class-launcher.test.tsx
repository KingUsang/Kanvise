import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardClassLauncher } from './dashboard-class-launcher'

const { authenticatedApiFetch } = vi.hoisted(() => ({ authenticatedApiFetch: vi.fn() }))
vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedApiFetch }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/navigation/NavigationProgress', () => ({ startNavigationProgress: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe('DashboardClassLauncher shared link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('copies the public /live/:shareToken URL, not the /class/:id URL', async () => {
    authenticatedApiFetch.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'class-1', share_token: 'opaque-token' } }), { status: 201 }))
    const user = userEvent.setup()
    render(<QueryClientProvider client={new QueryClient()}><DashboardClassLauncher user={{ id: 'u1', firstName: 'Ada', lastName: 'T' }} isAdmin={false} /></QueryClientProvider>)
    await user.click(screen.getByRole('button', { name: /Start live class/ }))
    await user.click(screen.getByRole('button', { name: /Start class now/ }))
    await user.click(await screen.findByRole('button', { name: 'Copy link' }))
    const copied = await navigator.clipboard.readText()
    expect(copied).toBe(`${window.location.origin}/live/opaque-token`)
    expect(copied).not.toContain('/class/')
  })
})
