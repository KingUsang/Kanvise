import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChangelogEntry } from '@/content/changelog'
import { ShellFrame } from './shell-frame'
import { NotAvailable } from './not-available'
import type { ShellActions, ShellData } from './types'

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))

const entries: ChangelogEntry[] = [
  { id: 'new', date: '2026-11-28', sections: { features: [{ name: 'New thing', text: 'Does something.' }] } },
  { id: 'old', date: '2026-11-20', sections: { features: [{ name: 'Old thing', text: 'Did something.' }], fixes: [{ name: 'Fix', text: 'Fixed.' }] } },
]

function adminData(overrides: Partial<ShellData> = {}): ShellData {
  return {
    person: { id: 'p-chidi', name: 'Chidi Okafor', email: 'chidi@example.com', photoUrl: null },
    capabilities: { isAdmin: true, isTutor: true, organisationType: 'centre' },
    account: { id: 'a-1', name: 'Science Students Academy', logoUrl: null },
    accounts: [
      { id: 'a-1', name: 'Science Students Academy', role: 'admin' },
      { id: 'a-2', name: 'Bright Path Tutors', role: 'tutor' },
    ],
    badges: { ungradedQuizzes: 3 },
    ...overrides,
  }
}

const tutorData = (): ShellData => adminData({
  person: { id: 'p-michael', name: 'Michael Chen', email: 'michael@example.com', photoUrl: null },
  capabilities: { isAdmin: false, isTutor: true, organisationType: 'centre' },
  accounts: [{ id: 'a-1', name: 'Science Students Academy', role: 'tutor' }],
})

function actions(overrides: Partial<ShellActions> = {}): ShellActions {
  return {
    switchAccount: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    sendFeedback: vi.fn(async () => undefined),
    getPendingUploadCount: vi.fn(async () => 0),
    ...overrides,
  }
}

function renderShell({ data = adminData(), shellActions = actions(), helpUrl, pathname = '/dashboard', initialOverlay }: {
  data?: ShellData
  shellActions?: ShellActions
  helpUrl?: string
  pathname?: string
  initialOverlay?: Parameters<typeof ShellFrame>[0]['initialOverlay']
} = {}) {
  return render(
    <ShellFrame shellData={data} actions={shellActions} links={{ helpUrl, changelog: entries }} pathname={pathname} initialOverlay={initialOverlay}>
      <h1>Page</h1>
    </ShellFrame>,
  )
}

function sidebar() {
  return within(screen.getByRole('complementary', { name: 'Sidebar' }))
}

describe('ShellFrame', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it('renders exactly one main landmark with the skip link target', () => {
    renderShell()
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content')
  })

  it('marks the active item with aria-current and the location bar', () => {
    renderShell({ pathname: '/dashboard/mocks/abc' })
    const active = sidebar().getByRole('link', { name: /Quizzes/ })
    expect(active).toHaveAttribute('aria-current', 'page')
    expect(active.querySelector('[data-location-bar]')).not.toBeNull()
    const other = sidebar().getByRole('link', { name: 'Dashboard' })
    expect(other).not.toHaveAttribute('aria-current')
    expect(other.querySelector('[data-location-bar]')).toBeNull()
  })

  it('names the marking count instead of showing a bare number', () => {
    renderShell()
    expect(sidebar().getByRole('link', { name: /Quizzes.*3 to mark/ })).toBeInTheDocument()
  })

  it('shows nothing, not a question mark, when the count failed', () => {
    renderShell({ data: adminData({ badges: { ungradedQuizzes: null } }) })
    expect(sidebar().getByRole('link', { name: 'Quizzes' })).not.toHaveTextContent('?')
  })

  it('toggles the collapse button and remembers it on this device', () => {
    renderShell()
    const toggle = sidebar().getByRole('button', { name: 'Collapse sidebar' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    const expand = sidebar().getByRole('button', { name: 'Expand sidebar' })
    expect(expand).toHaveAttribute('aria-expanded', 'false')
    expect(window.localStorage.getItem('kanvise:sidebar-collapsed:v1')).toBe('1')
    cleanup()
    renderShell()
    expect(sidebar().getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows Today, Calendar, Students and More to an agency admin', () => {
    renderShell()
    const bar = within(screen.getByRole('navigation', { name: 'Bottom bar' }))
    expect(bar.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Today', 'Calendar', 'Students', 'More'])
    expect(bar.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
    expect(bar.getByRole('link', { name: 'Today' }).querySelector('[data-location-bar]')).not.toBeNull()
  })

  it('shows Today, Calendar and More to an agency tutor', () => {
    renderShell({ data: tutorData() })
    const bar = within(screen.getByRole('navigation', { name: 'Bottom bar' }))
    expect(bar.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Today', 'Calendar', 'More'])
  })

  it('opens More as a sheet with every visible group, the account card and the user card', () => {
    renderShell()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Bottom bar' })).getByRole('button', { name: 'More' }))
    const sheet = within(screen.getByRole('dialog', { name: 'More' }))
    for (const label of ['Dashboard', 'Calendar', 'Timetable', 'Courses', 'Students', 'Tutors', 'Homework', 'Resources', 'Settings', 'Payments']) {
      expect(sheet.getByRole('link', { name: label })).toBeInTheDocument()
    }
    for (const group of ['People', 'Work', 'Library', 'Account']) expect(sheet.getByText(group)).toBeInTheDocument()
    expect(sheet.getByRole('button', { name: /switch tutoring account/i })).toBeInTheDocument()
    expect(sheet.getByRole('button', { name: /Chidi Okafor/ })).toBeInTheDocument()
    expect(sheet.queryByText(/Lessons|Recordings|Team/)).toBeNull()
  })

  it('hides Help guide when there is no help site', () => {
    renderShell()
    fireEvent.click(sidebar().getByRole('button', { name: 'Help, new updates' }))
    const menu = within(screen.getByRole('menu'))
    expect(menu.queryByRole('menuitem', { name: /Help guide/ })).toBeNull()
    expect(menu.getByRole('menuitem', { name: /What's new/ })).toHaveTextContent('New')
    expect(menu.getByRole('menuitem', { name: /Privacy policy/ })).toHaveAttribute('href', '/privacy')
  })

  it('shows Help guide in a new tab when the help site is set', () => {
    renderShell({ helpUrl: 'https://help.example.com' })
    fireEvent.click(sidebar().getByRole('button', { name: /^Help/ }))
    expect(screen.getByRole('menuitem', { name: /Help guide/ })).toHaveAttribute('target', '_blank')
  })

  it('clears the unread dot when What\'s new opens', () => {
    renderShell()
    fireEvent.click(sidebar().getByRole('button', { name: 'Help, new updates' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /What's new/ }))
    const dialog = within(screen.getByRole('dialog', { name: "What's new" }))
    expect(dialog.getAllByText('Recent updates to Kanvise').length).toBeGreaterThan(0)
    expect(dialog.getByText('Old thing', { exact: false, selector: 'strong' })).not.toBeVisible()
    fireEvent.click(dialog.getByRole('button', { name: /20 November/ }))
    expect(dialog.getByText('1 feature, 1 fix', { exact: false })).toBeInTheDocument()
    expect(dialog.queryByText('See the full changelog')).toBeNull()
    expect(window.localStorage.getItem('kanvise:whats-new-read:v1:p-chidi')).toBe('new')
    expect(sidebar().getByRole('button', { name: 'Help' })).toBeInTheDocument()
  })

  it('keeps Send disabled until something is typed, and keeps the text when sending fails', async () => {
    const sendFeedback = vi.fn(async () => { throw new Error('nope') })
    renderShell({ shellActions: actions({ sendFeedback }), initialOverlay: 'feedback' })
    const dialog = within(screen.getByRole('dialog', { name: 'Share feedback' }))
    const send = dialog.getByRole('button', { name: 'Send' })
    expect(send).toBeDisabled()
    fireEvent.change(dialog.getByLabelText('Message'), { target: { value: 'The calendar is great' } })
    expect(send).toBeEnabled()
    await act(async () => { fireEvent.click(send) })
    expect(sendFeedback).toHaveBeenCalledWith('The calendar is great')
    expect(await dialog.findByRole('alert')).toHaveTextContent("We couldn't send that. Try again in a moment.")
    expect(dialog.getByLabelText('Message')).toHaveValue('The calendar is great')
  })

  it('closes Share feedback after sending', async () => {
    renderShell({ initialOverlay: 'feedback' })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Thanks' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Share feedback' })).toBeNull())
  })

  it('signs out at once when nothing is waiting to upload', async () => {
    const shellActions = actions()
    renderShell({ shellActions })
    fireEvent.click(sidebar().getByRole('button', { name: /Chidi Okafor/ }))
    expect(screen.getByRole('menu')).toHaveTextContent('chidi@example.com')
    expect(screen.getByRole('menuitem', { name: 'My profile' })).toHaveAttribute('href', '/dashboard/profile')
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' })) })
    expect(shellActions.signOut).toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks before signing out when changes have not uploaded', async () => {
    const shellActions = actions({ getPendingUploadCount: vi.fn(async () => 2) })
    renderShell({ shellActions })
    fireEvent.click(sidebar().getByRole('button', { name: /Chidi Okafor/ }))
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' })) })
    const alert = within(screen.getByRole('alertdialog'))
    expect(alert.getByText("Some changes haven't uploaded yet. Sign out anyway?")).toBeInTheDocument()
    expect(alert.getByText("They'll be lost from this device.")).toBeInTheDocument()
    expect(shellActions.signOut).not.toHaveBeenCalled()
    fireEvent.click(alert.getByRole('button', { name: 'Stay signed in' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(shellActions.signOut).not.toHaveBeenCalled()
  })

  it('switches account from the account card', async () => {
    const shellActions = actions()
    renderShell({ shellActions })
    fireEvent.click(sidebar().getByRole('button', { name: /switch tutoring account/i }))
    const menu = within(screen.getByRole('menu', { name: 'Switch tutoring account' }))
    expect(menu.getByRole('menuitem', { name: /Science Students Academy/ })).toHaveTextContent('(current)')
    fireEvent.click(menu.getByRole('menuitem', { name: /Bright Path Tutors/ }))
    expect(shellActions.switchAccount).toHaveBeenCalledWith(expect.objectContaining({ id: 'a-2' }))
  })

  it('shows a plain account card without a switcher for one account', () => {
    renderShell({ data: tutorData() })
    expect(sidebar().queryByRole('button', { name: /switch tutoring account/i })).toBeNull()
    expect(sidebar().getByText('Tutoring agency')).toBeInTheDocument()
    expect(sidebar().getByText('Tutor · Science Students Academy')).toBeInTheDocument()
  })

  it('labels an independent tutor\'s account and shows their email', () => {
    renderShell({ data: adminData({
      person: { id: 'p-alex', name: 'Alex Thompson', email: 'alex@example.com', photoUrl: null },
      capabilities: { isAdmin: true, isTutor: true, organisationType: 'independent' },
      account: { id: 'a-3', name: 'Alex Thompson Tutoring', logoUrl: null },
      accounts: [{ id: 'a-3', name: 'Alex Thompson Tutoring', role: 'admin' }],
    }) })
    expect(sidebar().getByText('Your tutoring')).toBeInTheDocument()
    expect(sidebar().getByText('alex@example.com')).toBeInTheDocument()
    expect(sidebar().queryByRole('link', { name: 'Tutors' })).toBeNull()
  })

  it('shows skeleton rows while access is loading', () => {
    renderShell({ data: adminData({ loading: true }) })
    expect(sidebar().getByRole('status', { name: 'Loading the menu' })).toBeInTheDocument()
  })

  it('shows the signed-out dialog without a way to dismiss it', () => {
    render(
      <ShellFrame shellData={adminData()} actions={actions()} links={{ changelog: entries }} signedOut signInHref="/auth/login?redirect=%2Fdashboard">
        <p>Work in progress</p>
      </ShellFrame>,
    )
    const dialog = within(screen.getByRole('alertdialog', { name: "You've been signed out" }))
    expect(dialog.getByRole('link', { name: 'Sign in again' })).toHaveAttribute('href', '/auth/login?redirect=%2Fdashboard')
    expect(dialog.queryByRole('button', { name: 'Close' })).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('sets the bottom offset marker for toasts while the bottom bar shows', () => {
    renderShell()
    expect(document.documentElement.dataset.shellBottomBar).toBe('visible')
    cleanup()
    expect(document.documentElement.dataset.shellBottomBar).toBeUndefined()
  })
})

describe('NotAvailable', () => {
  afterEach(cleanup)

  it('uses the admin-only title for admin routes', () => {
    render(<NotAvailable reason="admin" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This page is for admins')
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard')
  })

  it('leaves out the admin line for independent tutors', () => {
    render(<NotAvailable independent />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("We can't show this page")
    expect(screen.getByText(/It may have been removed, or it belongs to someone else\./)).not.toHaveTextContent('ask your admin')
  })

  it('asks agency staff to check with their admin', () => {
    render(<NotAvailable />)
    expect(screen.getByText(/ask your admin/)).toBeInTheDocument()
  })
})
