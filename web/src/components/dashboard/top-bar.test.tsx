import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TopBar } from './top-bar'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/account/account-switcher', () => ({ AccountSwitcher: () => null }))
vi.mock('@/components/feedback/feedback-dialog', () => ({ FeedbackDialog: () => null }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/push-notifications', () => ({ detachBrowserPushOnLogout: vi.fn() }))
vi.mock('@/config/dashboard-navigation', () => ({ getDashboardNavItems: () => [] }))

const props = {
  user: { first_name: 'Ada', last_name: 'L', role: 'tutor' },
  capabilities: { setupRequired: false } as never,
}

describe('TopBar user menu', () => {
  afterEach(cleanup)

  it('moves focus into the menu, supports arrow keys, and returns focus on Escape', () => {
    render(<TopBar {...props} />)
    const trigger = screen.getByRole('button', { name: /Ada/ })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const items = screen.getAllByRole('menuitem')
    expect(items[0]).toHaveFocus()
    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(items[1]).toHaveFocus()
    fireEvent.keyDown(items[1], { key: 'ArrowDown' })
    expect(items[0]).toHaveFocus()
    fireEvent.keyDown(items[0], { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
  })
})
