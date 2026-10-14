import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './page'

const signInWithPassword = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the shared sign-in hierarchy and keeps provider failures out of the UI', async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: 'invalid_credentials', message: 'provider detail' } })
    const user = userEvent.setup()
    render(<LoginPage />)

    expect(screen.getByRole('heading', { name: 'Welcome back to Kanvise' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email address'), 'student@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't sign you in with those details")
    expect(screen.queryByText('provider detail')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('student@example.com')).toBeInTheDocument()
  })
})
