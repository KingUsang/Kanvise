import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  verifyOtp: vi.fn(),
  refreshSession: vi.fn(),
  resend: vi.fn(),
}))

const navigation = vi.hoisted(() => ({ pathname: '/auth/register' }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import RegisterPage from './page'

describe('centre registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.test')
    navigation.pathname = '/auth/register'
    auth.signUp.mockResolvedValue({ error: null })
    auth.verifyOtp.mockResolvedValue({
      data: {
        session: { access_token: 'verified-token' },
        user: { email: 'owner@example.com' },
      },
      error: null,
    })
    auth.refreshSession
      .mockResolvedValueOnce({
        data: { session: { access_token: 'profile-token', user: { app_metadata: {} } } },
        error: null,
      })
      // Keep the test on-page after centre creation so jsdom does not need to
      // emulate a full browser navigation.
      .mockResolvedValueOnce({
        data: { session: { access_token: 'centre-token', user: { app_metadata: {} } } },
        error: null,
      })

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ profile: { id: 'profile-1' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ school: { id: 'school-1' } }), { status: 200 })))
  })

  it('collects the centre name and creates the centre after email verification', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Centre name'), { target: { value: 'Bright Future Tutorials' } })
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Emmanuel' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Usang' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'SecurePass1!' } })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'owner@example.com',
      options: {
        data: {
          first_name: 'Emmanuel',
          last_name: 'Usang',
          centre_name: 'Bright Future Tutorials',
        },
      },
    }))

    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } })
    await user.click(screen.getByRole('button', { name: 'Verify email' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const fetchMock = vi.mocked(fetch)
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/auth\/profile\/init$/)
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      flow: 'centre',
      first_name: 'Emmanuel',
      last_name: 'Usang',
    })
    expect(fetchMock.mock.calls[1]?.[0]).toMatch(/\/schools$/)
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer profile-token' }),
      body: JSON.stringify({ name: 'Bright Future Tutorials' }),
    })
    expect(await screen.findByText(/centre was created, but the dashboard session could not be refreshed/i)).toBeInTheDocument()
  })

  it('does not add centre setup fields to student registration', () => {
    navigation.pathname = '/auth/register/student'
    render(<RegisterPage />)

    expect(screen.queryByLabelText('Centre name')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Join your programme' })).toBeInTheDocument()
  })
})
