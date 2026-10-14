import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResetPasswordPage from './page'

const getUser = vi.fn()
const updateUser = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser, updateUser, getSession: vi.fn() } }),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateUser.mockResolvedValue({ error: null })
  })

  it('shows a session check before the password form', () => {
    getUser.mockReturnValue(new Promise(() => undefined))
    render(<ResetPasswordPage />)
    expect(screen.getByText('Checking password reset…')).toBeInTheDocument()
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  })

  it('offers recovery actions instead of a disabled form when the recovery session is absent', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    render(<ResetPasswordPage />)
    expect(await screen.findByRole('heading', { name: 'This reset link can’t be used' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new code' })).toHaveAttribute('href', '/auth/forgot-password')
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  })
})
