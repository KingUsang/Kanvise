'use client'

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { BookMarked } from 'lucide-react'
import { getDashboardPageTitle, deniedReason, type DashboardCapabilities } from '@/config/dashboard-navigation'
import { changelog, type ChangelogEntry } from '@/content/changelog'
import { EmptyState, ErrorState, PageLoadingState } from '@/components/dashboard/async-states'
import { Button } from '@/components/dashboard/action-controls'
import { PageHeader } from '@/components/ui/page-header'
import { NotAvailable } from '@/components/shell/not-available'
import { SearchProvider, SearchTrigger, type SearchPreviewState } from '@/components/shell/search-palette'
import { ShellFrame } from '@/components/shell/shell-frame'
import type { ShellData, ShellOverlay } from '@/components/shell/types'
import { markWhatsNewRead } from '@/lib/shell-preferences'
import { toast } from '@/lib/toast'
import type { SearchFunction, SearchGroup } from '@/lib/search'
import { useOfflineBanner } from '@/components/ui/offline-banner'
import { useUploadingCount } from '@/lib/offline/use-autosave-field'
import { AutosaveDemo, getDemoQueue, useDemoOnline } from '@/app/design-system/autosave-demo'

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
  search?: string
  connection?: string
  toast?: 'undo'
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
  const badges = { ungradedQuizzes: Number.isFinite(badgeCount) ? badgeCount : null, ungradedQuizzesUnavailable: options.badge === 'failed' }
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

const searchStates: SearchPreviewState[] = ['empty', 'results', 'no-results', 'error', 'offline', 'loading']

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

// Sample search results, filtered by what is typed. Preview only.
function sampleGroups(role: PreviewOptions['role']): SearchGroup[] {
  const groups: SearchGroup[] = [
    {
      type: 'student', label: 'Students', results: [
        { id: 's1', type: 'student', name: 'Ada Okonkwo', detail: 'ada.okonkwo@example.com', href: '/dashboard/students' },
        { id: 's2', type: 'student', name: 'Adaeze Nwosu', detail: 'No email', href: '/dashboard/students' },
      ],
    },
    { type: 'tutor', label: 'Tutors', results: [{ id: 't1', type: 'tutor', name: 'Adam Bello', detail: 'adam.bello@example.com', href: '/dashboard/tutors' }] },
    { type: 'course', label: 'Courses', results: [{ id: 'c1', type: 'course', name: 'Adaptive Maths Revision', detail: null, href: '/dashboard/classes/c1' }] },
    {
      type: 'lesson', label: 'Lessons', results: [
        { id: 'l1', type: 'lesson', name: 'Ada catch-up: simultaneous equations', detail: `Adaptive Maths Revision · ${new Date(inDays(1)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, href: '/dashboard/schedule/l1', status: 'planned', scheduled_at: inDays(1) },
        { id: 'l2', type: 'lesson', name: 'Adaptive Maths: quadratics', detail: `Adaptive Maths Revision · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, href: '/dashboard/schedule/l2', status: 'live', scheduled_at: inDays(0) },
      ],
    },
  ]
  if (role === 'tutor') return groups.filter((group) => group.type === 'course' || group.type === 'lesson')
  if (role === 'independent') return groups.filter((group) => group.type !== 'tutor')
  return groups
}

function previewSearch(role: PreviewOptions['role'], state?: SearchPreviewState): SearchFunction {
  return async (query) => {
    await wait(300)
    if (state === 'error') throw new Error('Preview failure')
    const term = query.toLowerCase()
    const groups = sampleGroups(role)
      .map((group) => ({ ...group, results: group.results.filter((result) => `${result.name} ${result.detail ?? ''}`.toLowerCase().includes(term)) }))
      .filter((group) => group.results.length > 0)
    return { query, groups }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const noSubscribe = () => () => undefined

export function ShellPreview({ options, content: contentOverride, setup }: {
  options: PreviewOptions
  /** Page content that replaces the sample page (used by the dashboard and setup previews). */
  content?: ReactNode
  /** Sidebar setup card progress (SH-02 item 3). */
  setup?: ShellData['setup']
}) {
  // Render on the client only: overlays that start open are portals, which
  // the server cannot render, so hydrating them would not match.
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false)
  const data = fixture(options)
  const loading = options.page === 'loading'
  const shellData: ShellData = {
    ...data,
    loading,
    setup: setup ?? null,
    capabilities: { ...data.capabilities, setupVisible: Boolean(setup) },
  }
  const path = options.path ?? (options.page === 'admin-only' ? '/dashboard/tutors' : '/dashboard')
  // ?read=1 shows the state after What's new was opened. Writing the read
  // marker once, before the shell reads it, is idempotent.
  useState(() => {
    if (options.read && typeof window !== 'undefined') markWhatsNewRead(data.person.id, changelog[0].id)
    return true
  })

  // ?connection=offline|reconnecting fixes the banner; otherwise it follows
  // the real connection and the saving demo (?page=saving).
  const online = useDemoOnline()
  const liveBanner = useOfflineBanner(online, useUploadingCount(getDemoQueue()))
  const offlineBanner = options.connection === 'offline'
    ? { mode: 'offline' as const, count: 0 }
    : options.connection === 'reconnecting'
      ? { mode: 'reconnecting' as const, count: options.pending || 2 }
      : liveBanner

  const title = getDashboardPageTitle(path)
  let content
  if (contentOverride) content = contentOverride
  else if (options.page === 'not-available') content = <NotAvailable independent={options.role === 'independent'} />
  else if (options.page === 'admin-only') content = <NotAvailable reason={deniedReason(path, data.capabilities)} independent={options.role === 'independent'} />
  else if (options.page === 'error') content = <ErrorState size="card" onRetry={() => toast.info('Trying again.')} />
  else if (loading) content = <PageLoadingState label="Loading this page" />
  else if (options.page === 'saving' || options.page === 'conflict') content = (
    <>
      <PageHeader title="Lesson plan" description="A preview of a field that saves by itself (SH-13). The real editors arrive in later build steps." />
      <div className="mt-8">
        <AutosaveDemo initialConflict={options.page === 'conflict'} />
      </div>
    </>
  )
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

  // ?toast=undo shows a toast with Undo, to check it sits above the bottom bar (R-10).
  useEffect(() => {
    if (!mounted || options.toast !== 'undo') return
    // Wait a moment so the app's toaster has mounted and is listening.
    let handle: { close: () => void } | undefined
    const timer = setTimeout(() => {
      handle = toast.undo({ text: 'Homework deleted.', onUndo: () => toast.info('Homework restored.') })
    }, 300)
    return () => {
      clearTimeout(timer)
      handle?.close()
    }
  }, [mounted, options.toast])

  if (!mounted) return null

  const open = overlays.includes(options.open as ShellOverlay) ? (options.open as ShellOverlay) : undefined

  const searchState = searchStates.includes(options.search as SearchPreviewState) ? (options.search as SearchPreviewState) : undefined
  const initialQuery = searchState === 'no-results' ? 'Photosynthesis' : searchState && searchState !== 'empty' ? 'Ada' : ''

  return (
    <SearchProvider
      capabilities={data.capabilities}
      search={previewSearch(options.role, searchState)}
      initialOpen={Boolean(searchState)}
      initialQuery={initialQuery}
      previewState={searchState}
      onOpenResult={(href) => toast.info(`In the app this opens ${href}.`)}
    >
    <ShellFrame
      searchSlot={(rail) => <SearchTrigger variant="sidebar" rail={rail} />}
      phoneSearchSlot={<SearchTrigger variant="phone" />}
      shellData={shellData}
      pathname={path}
      initialOverlay={open}
      initialCollapsed={options.rail}
      signedOut={options.signedOut}
      offlineBanner={offlineBanner}
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
    </SearchProvider>
  )
}
