import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const setSession = vi.fn()

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('account_invitation_token=invitation-token'),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { setSession } }),
}))

vi.mock('@/lib/invitation-session', () => ({
  readInvitationSessionFragment: () => ({ accessToken: null, refreshToken: null, error: 'sensitive provider failure' }),
}))

import InvitationCallbackPage from './page'

describe('InvitationCallbackPage', () => {
  it('shows a safe recovery message rather than a provider error', async () => {
    render(<InvitationCallbackPage />)

    expect(await screen.findByText('Your sign-in didn’t finish. Open the invitation again to continue.')).toBeInTheDocument()
    expect(screen.queryByText('sensitive provider failure')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to invitation' })).toHaveAttribute('href', '/invite?token=invitation-token')
    expect(setSession).not.toHaveBeenCalled()
  })
})
