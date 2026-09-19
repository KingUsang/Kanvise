import { render, screen, within } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StudentShell } from './student-shell'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mocks = vi.hoisted(() => ({ pathname: '/dashboard/student' }))

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }))
vi.mock('@supabase/ssr', () => ({ createBrowserClient: vi.fn() }))
vi.mock('@/lib/push-notifications', () => ({ detachBrowserPushOnLogout: vi.fn() }))

describe('StudentShell navigation', () => {
  beforeEach(() => { mocks.pathname = '/dashboard/student' })
  function renderShell(element: React.ReactElement) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>)
  }

  it('uses visible mobile destinations without a hamburger for programme students', () => {
    renderShell(<StudentShell studentName="Ada Student" schoolName="Bright Minds"><p>Content</p></StudentShell>)

    const mobileNavigation = screen.getByRole('navigation', { name: 'Student navigation' })
    expect(mobileNavigation).toHaveTextContent('Home')
    expect(mobileNavigation).toHaveTextContent('Learn')
    expect(mobileNavigation).toHaveTextContent('Mocks')
    expect(mobileNavigation).toHaveTextContent('Progress')
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps standalone navigation focused on home and mocks', () => {
    renderShell(<StudentShell studentName="Ada Student" schoolName="Kanvise" hasCentreLearning={false}><p>Content</p></StudentShell>)

    const mobileNavigation = screen.getByRole('navigation', { name: 'Student navigation' })
    expect(mobileNavigation).toHaveTextContent('Home')
    expect(mobileNavigation).toHaveTextContent('Mocks')
    expect(mobileNavigation).not.toHaveTextContent('Learn')
    expect(mobileNavigation).not.toHaveTextContent('Progress')
  })
})
