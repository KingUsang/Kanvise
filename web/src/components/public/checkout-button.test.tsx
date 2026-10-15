import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CheckoutButton } from './checkout-button'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn(), push: vi.fn(), toastError: vi.fn() }))

vi.mock('../../lib/supabase/client', () => ({ createClient: () => ({ auth: { getSession: mocks.getSession, refreshSession: mocks.refreshSession } }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }), useSearchParams: () => new URLSearchParams() }))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))

describe('CheckoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.test')
  })

  it('creates a student registration intent while preserving the programme return path', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'student-intent' }), { status: 201 })))
    render(<CheckoutButton schoolSlug="bright-future" programmeSlug="jamb-physics" programmeId="programme-1" price={0}/>)

    await userEvent.click(screen.getByRole('button', { name: 'Join programme' }))

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/auth/register/student?intent=student-intent&return_to=%2Fbright-future%2Fjamb-physics%3Fcheckout%3Dtrue'))
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/auth/registration-intents/student', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ return_to: '/bright-future/jamb-physics?checkout=true' }),
    }))
  })

  it('turns the backend already-enrolled response into an open-programme state', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'student-token' } } })
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { role: 'student' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'ALREADY_ENROLLED', error: 'Already enrolled' }), { status: 409 })))
    render(<CheckoutButton schoolSlug="bright-future" programmeSlug="jamb-physics" programmeId="programme-1" price={0}/>)

    await userEvent.click(screen.getByRole('button', { name: 'Join programme' }))

    expect(await screen.findByRole('button', { name: 'Open class' })).toBeInTheDocument()
    expect(screen.getByText('You’re already enrolled in this class.')).toBeInTheDocument()
    expect(mocks.toastError).not.toHaveBeenCalled()
  })
})
