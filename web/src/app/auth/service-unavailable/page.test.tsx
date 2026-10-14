import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AuthServiceUnavailablePage from './page'

describe('AuthServiceUnavailablePage', () => {
  it('retries the current destination instead of sending the person to a dashboard', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } })
    const user = userEvent.setup()
    render(<AuthServiceUnavailablePage />)

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(reload).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/auth/login')
  })
})
