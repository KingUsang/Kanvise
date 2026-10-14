import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InvitePage from './page'

const replace = vi.fn()
const getUser = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams('token=valid-invitation-token'),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser } }),
}))

describe('canonical invitation page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ data: { user: null } })
  })

  it('shows verified invitation context without asking the recipient to choose a role', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      role: 'student',
      email: 'learner@example.com',
      school_name: 'Bright Future Tutorials',
      status: 'pending',
      expires_at: '2099-01-01T00:00:00.000Z',
      metadata: { programme_name: 'WAEC Mathematics' },
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    render(<InvitePage />)

    expect(await screen.findByRole('heading', { name: 'Accept your invitation' })).toBeInTheDocument()
    expect(screen.getAllByText('WAEC Mathematics').length).toBeGreaterThan(0)
    expect(screen.getAllByText('learner@example.com').length).toBeGreaterThan(0)
    expect(screen.queryByText('Independent tutor')).not.toBeInTheDocument()
    expect(screen.queryByText('Tutorial agency')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute('href', expect.stringContaining('intent=invitation'))
  })

  it('uses safe recovery copy for an invalid link without displaying the API detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'database implementation detail',
      code: 'INVITATION_INVALID',
    }), { status: 404, headers: { 'Content-Type': 'application/json' } })))

    render(<InvitePage />)

    expect(await screen.findByRole('heading', { name: 'Invitation unavailable' })).toBeInTheDocument()
    expect(screen.getByText(/isn't valid/i)).toBeInTheDocument()
    expect(screen.queryByText(/database implementation detail/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
})
