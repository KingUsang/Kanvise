import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const signOut = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut } }),
}))
import CompleteProfilePage from './page'

afterEach(() => cleanup())

describe('CompleteProfilePage', () => {
  it('only asks an educator agency administrator for the required agency name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      intent: 'educator', account_type: 'centre', agency_name: 'Bright Future Tutorials', email: 'owner@example.com', first_name: 'Ada', last_name: 'Okafor',
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    render(<CompleteProfilePage />)

    expect(await screen.findByRole('heading', { name: 'Let’s finish setting up your account' })).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toHaveValue('Ada Okafor')
    expect(screen.getByLabelText('Tutoring agency name')).toHaveValue('Bright Future Tutorials')
  })

  it('preserves student context without presenting educator setup choices', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      intent: 'student', email: 'student@example.com', first_name: 'Sam', last_name: 'Learner',
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    render(<CompleteProfilePage />)

    expect(await screen.findByRole('heading', { name: 'Finish joining your class' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Tutoring agency name')).not.toBeInTheDocument()
    expect(screen.queryByText('Independent tutor')).not.toBeInTheDocument()
  })

  it('offers a safe account switch when an invitation email does not match Google', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        intent: 'invitation', email: 'wrong@example.com', first_name: 'Ada', last_name: 'Okafor', invitation_token: 'invite-token',
        invitation: { role: 'student', school_name: 'Bright Future Tutorials' },
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'INVITATION_EMAIL_MISMATCH' }), { status: 403, headers: { 'Content-Type': 'application/json' } })))

    render(<CompleteProfilePage />)
    await user.click(await screen.findByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('This invitation was sent to a different email address. Sign in with the invited account to continue.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Use the invited account instead' }))
    expect(signOut).toHaveBeenCalledOnce()
  })
})
