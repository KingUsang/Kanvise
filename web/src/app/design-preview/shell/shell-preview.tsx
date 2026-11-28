'use client'

import { useState, useSyncExternalStore } from 'react'
import { BookMarked } from 'lucide-react'
import { getDashboardPageTitle, deniedReason, type DashboardCapabilities } from '@/config/dashboard-navigation'
import { changelog, type ChangelogEntry } from '@/content/changelog'
import { EmptyState, ErrorState, PageLoadingState } from '@/components/dashboard/async-states'
import { Button } from '@/components/dashboard/action-controls'
import { PageHeader } from '@/components/ui/page-header'
import { NotAvailable } from '@/components/shell/not-available'
import { ShellFrame } from '@/components/shell/shell-frame'
import type { ShellData, ShellOverlay } from '@/components/shell/types'
import { markWhatsNewRead } from '@/lib/shell-preferences'
import { toast } from '@/lib/toast'

export type PreviewOptions = {
  role: 'admin' | 'tutor' | 'independent'
  open?: string
  page?: string
  rail: boolean
  path?: string
  long: boolean
  badge?: string
  read: boolean
  pending: number
  signedOut: boolean
}

const overlays: ShellOverlay[] = ['more', 'help', 'account-menu', 'switcher', 'whats-new', 'feedback', 'sign-out-confirm', 'phone-menu']

// Sample older days so the "Read earlier" rows can be checked. Preview only.
const sampleEarlier: ChangelogEntry[] = [
  {
    id: 'preview-older-1',
    date: '2026-11-20',
    sections: {
      features: [{ name: 'Sample feature', text: 'An older update, shown here only so the collapsed rows can be checked.' }],
      fixes: [{ name: 'Sample fix', text: 'Another older update for the same check.' }],
    },
  },
  {
    id: 'preview-older-2',
    date: '2026-11-12',
    sections: {
      features: [
        { name: 'Sample feature one', text: 'Preview content.' },
        { name: 'Sample feature two', text: 'Preview content.' },
      ],
      speed: [{ name: 'Sample speed-up', text: 'Preview content.' }],
    },
  },
]

function fixture(options: PreviewOptions): ShellData {
  const longAgency = 'The Northern Lights Science and Mathematics Students Academy'
  const agency = options.long ? longAgency : 'Science Students Academy'
  const badgeCount = options.badge === 'failed' ? null : Number(options.badge ?? 3)
  const badges = { ungradedQuizzes: Number.isFinite(badgeCount) ? badgeCount : null }
  if (options.role === 'tutor') {
    const capabilities: DashboardCapabilities = { isAdmin: false, isTutor: true, organisationType: 'centre' }
    return {
      person: { id: 'preview-michael', name: options.long ? 'Michael Alexander Chen-Whitworth' : 'Michael Chen', email: 'michael.chen@example.com', photoUrl: null },
      capabilities,
      account: { id: 'acct-ssa', name: agency, logoUrl: null },
      accounts: [{ id: 'acct-ssa', name: agency, role: 'tutor' }],
      badges,
    }
  }
  if (options.role === 'independent') {
    const name = options.long ? 'Alexandra Thompson-Montgomery Maths and Science Tutoring' : 'Alex Thompson Tutoring'
    return {
      person: { id: 'preview-alex', name: 'Alex Thompson', email: 'alex.thompson@example.com', photoUrl: null },
      capabilities: { isAdmin: true, isTutor: true, organisationType: 'independent' },
      account: { id: 'acct-alex', name, logoUrl: null },
      accounts: [{ id: 'acct-alex', name, role: 'admin' }],
      badges,
    }
  }
  return {
    person: { id: 'preview-chidi', name: options.long ? 'Chidinma Okafor-Adeyemi' : 'Chidi Okafor', email: 'chidi.okafor@example.com', photoUrl: null },
    capabilities: { isAdmin: true, isTutor: true, organisationType: 'centre' },
    account: { id: 'acct-ssa', name: agency, logoUrl: null },
    accounts: [
      { id: 'acct-ssa', name: agency, role: 'admin' },
      { id: 'acct-bright', name: 'Bright Path Tutors', role: 'tutor' },
    ],
    badges,
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const noSubscribe = () => () => undefined

export function ShellPreview({ options }: { options: PreviewOptions }) {
  // Render on the client only: overlays that start open are portals, which
  // the server cannot render, so hydrating them would not match.
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false)
  const data = fixture(options)
  const loading = options.page === 'loading'
  const shellData: ShellData = { ...data, loading }
  const path = options.path ?? (options.page === 'admin-only' ? '/dashboard/tutors' : '/dashboard')
  // ?read=1 shows the state after What's new was opened. Writing the read
  // marker once, before the shell reads it, is idempotent.
  useState(() => {
    if (options.read && typeof window !== 'undefined') markWhatsNewRead(data.person.id, changelog[0].id)
    return true
  })

  const title = getDashboardPageTitle(path)
  let content
  if (options.page === 'not-available') content = <NotAvailable independent={options.role === 'independent'} />
  else if (options.page === 'admin-only') content = <NotAvailable reason={deniedReason(path, data.capabilities)} independent={options.role === 'independent'} />
  else if (options.page === 'error') content = <ErrorState size="card" onRetry={() => toast.info('Trying again.')} />
  else if (loading) content = <PageLoadingState label="Loading this page" />
  else content = (
    <>
      <PageHeader
        title={path === '/dashboard' ? 'Dashboard' : title}
        description="A preview of the app shell. The real page content arrives in later build steps."
        primaryAction={<Button onClick={() => toast.success('Saved.')}>Show a toast</Button>}
      />
      <div className="mt-8">
        <EmptyState
          entity="course"
          icon={<BookMarked />}
          title="No courses yet"
          body="A course pairs a student with a tutor over time."
        />
      </div>
    </>
  )

  if (!mounted) return null

  const open = overlays.includes(options.open as ShellOverlay) ? (options.open as ShellOverlay) : undefined

  return (
    <ShellFrame
      shellData={shellData}
      pathname={path}
      initialOverlay={open}
      initialCollapsed={options.rail}
      signedOut={options.signedOut}
      links={{
        helpUrl: 'https://help.example.com',
        changelogUrl: 'https://example.com/changelog',
        changelog: [...changelog, ...sampleEarlier],
      }}
      actions={{
        switchAccount: async (account) => { toast.success(`Now in ${account.name}.`) },
        signOut: async () => { await wait(300); toast.info('In the app you would be signed out now.') },
        sendFeedback: async (message) => {
          await wait(400)
          if (message.toLowerCase().includes('fail')) throw new Error('Preview failure')
        },
        getPendingUploadCount: async () => options.pending,
      }}
    >
      {content}
    </ShellFrame>
  )
}
