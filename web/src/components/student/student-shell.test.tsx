import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StudentShell } from './student-shell'

const mocks = vi.hoisted(() => ({ pathname: '/dashboard/student' }))

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }))
vi.mock('@supabase/ssr', () => ({ createBrowserClient: vi.fn() }))
vi.mock('@/lib/push-notifications', () => ({ detachBrowserPushOnLogout: vi.fn() }))

describe('StudentShell navigation', () => {
  beforeEach(() => { mocks.pathname = '/dashboard/student' })

  it('uses visible mobile destinations without a hamburger for programme students', () => {
    render(<StudentShell studentName="Ada Student" schoolName="Bright Minds"><p>Content</p></StudentShell>)

    const mobileNavigation = screen.getByRole('navigation', { name: 'Student navigation' })
    expect(mobileNavigation).toHaveTextContent('Home')
    expect(mobileNavigation).toHaveTextContent('Learn')
    expect(mobileNavigation).toHaveTextContent('Mocks')
    expect(mobileNavigation).toHaveTextContent('Progress')
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps standalone navigation focused on home and mocks', () => {
    render(<StudentShell studentName="Ada Student" schoolName="Kanvise" hasCentreLearning={false}><p>Content</p></StudentShell>)

    const mobileNavigation = screen.getByRole('navigation', { name: 'Student navigation' })
    expect(mobileNavigation).toHaveTextContent('Home')
    expect(mobileNavigation).toHaveTextContent('Mocks')
    expect(mobileNavigation).not.toHaveTextContent('Learn')
    expect(mobileNavigation).not.toHaveTextContent('Progress')
  })
})
