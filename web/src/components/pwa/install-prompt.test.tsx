import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
import { InstallPrompt } from './install-prompt'

describe('InstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 Chrome/140' })
  })

  it('offers the captured browser installation prompt on entry pages', async () => {
    render(<InstallPrompt />)
    const prompt = vi.fn(async () => undefined)
    const event = Object.assign(new Event('beforeinstallprompt'), { prompt, userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }) })
    await act(async () => window.dispatchEvent(event))
    fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    await act(async () => undefined)
    expect(prompt).toHaveBeenCalledOnce()
  })

  it('shows iOS Add to Home Screen guidance without invoking unsupported APIs', async () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone)' })
    render(<InstallPrompt />)
    expect(await screen.findByText(/Add to Home Screen/)).toBeInTheDocument()
  })

  it('stores a thirty-day dismissal marker', async () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone)' })
    render(<InstallPrompt />)
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss install suggestion' }))
    expect(Number(localStorage.getItem('kanvise-install-dismissed-at'))).toBeGreaterThan(0)
  })
})
