import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterPage from './page'

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  verifyOtp: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/auth/register/student',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('intent=student-intent&return_to=%2Fmock%2Fbiology'),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: mocks }) }))
vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))

async function completeForm() {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('John'), 'Ada')
  await user.type(screen.getByPlaceholderText('Doe'), 'Lovelace')
  await user.type(screen.getByPlaceholderText('you@example.com'), 'ADA@Example.com ')
  await user.type(screen.getByLabelText('Password'), 'StrongPass1!')
  await user.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('student registration identity handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: 'invalid_credentials' } })
  })

  it('does not wait for a nonexistent email when Supabase conceals a duplicate account', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { identities: [] } }, error: null })
    render(<RegisterPage />)

    await completeForm()

    expect(await screen.findByText(/An account already uses this email/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Check your email' })).not.toBeInTheDocument()
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'StrongPass1!' })
  })

  it('sends a verification code for a genuinely new student identity', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { identities: [{ id: 'identity-1' }] } }, error: null })
    render(<RegisterPage />)

    await completeForm()

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'ada@example.com' })))
  })
})
