'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { toast as sonnerToast } from 'sonner'
import { getDashboardPageTitle } from '@/config/dashboard-navigation'
import { AlertDialog } from '@/components/ui/dialog'
import { SkipLink } from '@/components/ui/live-region'
import { Sheet } from '@/components/ui/sheet'
import { markWhatsNewRead, setSidebarCollapsed, useSidebarCollapsed, useWhatsNewUnread } from '@/lib/shell-preferences'
import { BottomBar, PhoneTopBar } from './phone-chrome'
import { ShellChromeProvider, type ShellChrome } from './shell-context'
import { accountMenuItems, helpMenuItems } from './shell-menus'
import { ShareFeedbackDialog } from './share-feedback-dialog'
import { SignedOutDialog } from './signed-out-dialog'
import { DesktopSidebar, SidebarContent } from './sidebar'
import type { ShellAccount, ShellActions, ShellData, ShellLinks, ShellOverlay } from './types'
import { WhatsNewDialog } from './whats-new-dialog'

type Tier = 'phone' | 'tablet' | 'desktop'

const TABLET_QUERY = '(min-width: 768px)'
const DESKTOP_QUERY = '(min-width: 1024px)'

function currentTier(): Tier {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop'
  if (window.matchMedia(DESKTOP_QUERY).matches) return 'desktop'
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet'
  return 'phone'
}

function subscribeTier(listener: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
  const queries = [window.matchMedia(TABLET_QUERY), window.matchMedia(DESKTOP_QUERY)]
  queries.forEach((query) => query.addEventListener?.('change', listener))
  return () => queries.forEach((query) => query.removeEventListener?.('change', listener))
}

/** Screen width tier. Desktop while rendering on the server; CSS handles first paint. */
function useTier() {
  return useSyncExternalStore(subscribeTier, currentTier, () => 'desktop' as Tier)
}

const KEYBOARD_THRESHOLD_PX = 150

function isTextEntry(element: Element | null) {
  if (!element) return false
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(element.type)
  return (element as HTMLElement).isContentEditable === true
}

/** True while the on-screen keyboard is likely open (visual viewport much shorter than the window). */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const check = () => setOpen(window.innerHeight - viewport.height > KEYBOARD_THRESHOLD_PX && isTextEntry(document.activeElement))
    viewport.addEventListener('resize', check)
    document.addEventListener('focusin', check)
    document.addEventListener('focusout', check)
    return () => {
      viewport.removeEventListener('resize', check)
      document.removeEventListener('focusin', check)
      document.removeEventListener('focusout', check)
    }
  }, [])
  return open
}

export type ShellFrameProps = {
  shellData: ShellData
  actions: ShellActions
  links: ShellLinks
  children: ReactNode
  /** Overrides the current path (design preview). */
  pathname?: string
  /** The sign-in ended without the person signing out (SH-14b). */
  signedOut?: boolean
  /** Where "Sign in again" goes. */
  signInHref?: string
  /** Called before signing out, so a sign-out is not mistaken for an expired sign-in. */
  onSignOutStart?: () => void
  /** Search trigger, filled by the search feature (SH-05). */
  searchSlot?: ReactNode
  phoneSearchSlot?: ReactNode
  /** Design preview: open an overlay on first render. */
  initialOverlay?: ShellOverlay
  /** Design preview: start with the desktop rail. */
  initialCollapsed?: boolean
}

/**
 * The tutor and admin app shell (01-app-shell SH-01, SH-02, SH-16; 16-responsive
 * R-02, R-10). Presentation only: DashboardShell loads `shellData`, the design
 * preview passes fixtures.
 */
export function ShellFrame({
  shellData,
  actions,
  links,
  children,
  pathname: pathnameOverride,
  signedOut = false,
  signInHref = '/auth/login',
  onSignOutStart,
  searchSlot,
  phoneSearchSlot,
  initialOverlay,
  initialCollapsed,
}: ShellFrameProps) {
  const routerPathname = usePathname()
  const pathname = pathnameOverride ?? routerPathname ?? '/dashboard'
  const tier = useTier()
  const storedCollapsed = useSidebarCollapsed()
  const [previewCollapsed, setPreviewCollapsed] = useState(initialCollapsed)
  const collapsed = previewCollapsed ?? storedCollapsed
  const [tabletExpanded, setTabletExpanded] = useState(false)
  const [moreOpen, setMoreOpen] = useState(initialOverlay === 'more')
  const [dialog, setDialog] = useState<null | 'whats-new' | 'feedback'>(
    initialOverlay === 'whats-new' ? 'whats-new' : initialOverlay === 'feedback' ? 'feedback' : null,
  )
  const [confirmSignOut, setConfirmSignOut] = useState(initialOverlay === 'sign-out-confirm')
  const [signingOut, setSigningOut] = useState(false)
  const [hideRequests, setHideRequests] = useState(0)
  const keyboardOpen = useKeyboardOpen()
  const toggleRef = useRef<HTMLElement | null>(null)

  const newestEntryId = links.changelog[0]?.id
  const unread = useWhatsNewUnread(shellData.person.id, newestEntryId)

  // Close the tablet overlay and the More sheet after moving to another page.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setTabletExpanded(false)
    setMoreOpen(false)
  }

  useEffect(() => {
    if (tier !== 'tablet' || !tabletExpanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setTabletExpanded(false)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [tier, tabletExpanded])

  const toggleSidebar = () => {
    toggleRef.current = document.querySelector<HTMLElement>('[aria-controls="dashboard-sidebar"]')
    if (tier === 'desktop') {
      if (previewCollapsed !== undefined) setPreviewCollapsed(!collapsed)
      else setSidebarCollapsed(!collapsed)
      return
    }
    setTabletExpanded((value) => !value)
  }

  const hideBottomBar = useCallback(() => {
    setHideRequests((count) => count + 1)
    let released = false
    return () => {
      if (released) return
      released = true
      setHideRequests((count) => Math.max(0, count - 1))
    }
  }, [])

  const bottomBarHidden = hideRequests > 0 || keyboardOpen

  // Toasts, the Fab and fixed page bars read --shell-bottom-offset, which
  // globals.css derives from these attributes on <html> (R-10).
  useEffect(() => {
    const root = document.documentElement
    if (bottomBarHidden) delete root.dataset.shellBottomBar
    else root.dataset.shellBottomBar = 'visible'
    return () => { delete root.dataset.shellBottomBar }
  }, [bottomBarHidden])

  const openWhatsNew = () => {
    if (newestEntryId) markWhatsNewRead(shellData.person.id, newestEntryId)
    setDialog('whats-new')
  }

  useEffect(() => {
    if (initialOverlay === 'whats-new' && newestEntryId) markWhatsNewRead(shellData.person.id, newestEntryId)
  }, [initialOverlay, newestEntryId, shellData.person.id])

  const canSendFeedback = Boolean(shellData.account) && !shellData.capabilities.setupRequired
  const openFeedback = canSendFeedback ? () => setDialog('feedback') : undefined

  const signOutNow = async () => {
    setSigningOut(true)
    onSignOutStart?.()
    try {
      await actions.signOut()
    } catch {
      setSigningOut(false)
      setConfirmSignOut(false)
      sonnerToast.error("We couldn't sign you out. Try again.")
    }
  }

  const requestSignOut = async () => {
    if (signingOut) return
    const pending = await actions.getPendingUploadCount().catch(() => 0)
    if (pending > 0) setConfirmSignOut(true)
    else void signOutNow()
  }

  const switchAccount = (account: ShellAccount) => {
    void actions.switchAccount(account)
  }

  const chrome = useMemo<ShellChrome>(() => ({ capabilities: shellData.capabilities, hideBottomBar }), [shellData.capabilities, hideBottomBar])

  const contentProps = {
    data: shellData,
    pathname,
    links,
    unread,
    signingOut,
    initialOverlay,
    searchSlot,
    onSwitchAccount: switchAccount,
    onOpenWhatsNew: openWhatsNew,
    onOpenFeedback: openFeedback,
    onSignOut: () => void requestSignOut(),
  }

  const phoneMenuItems = [
    ...accountMenuItems({ onSignOut: () => void requestSignOut(), signingOut }),
    { type: 'separator' as const },
    ...helpMenuItems({ unread, helpUrl: links.helpUrl, onWhatsNew: openWhatsNew, onFeedback: openFeedback }),
  ]

  const railShowing = tier === 'desktop' ? collapsed : tier === 'tablet' ? !tabletExpanded : false
  const toggleExpanded = tier === 'desktop' ? !collapsed : tier === 'tablet' ? tabletExpanded : true

  return (
    <ShellChromeProvider value={chrome}>
      <div className="min-h-dvh bg-dashboard-page font-sans text-dashboard-foreground">
        <SkipLink />
        <DesktopSidebar
          {...contentProps}
          collapsed={collapsed}
          tabletExpanded={tabletExpanded}
          toggleExpanded={toggleExpanded}
          tooltips={railShowing}
          onToggle={toggleSidebar}
          onCloseTablet={() => setTabletExpanded(false)}
        />
        <div className={`md:ml-dashboard-rail ${collapsed ? 'lg:ml-dashboard-rail' : 'lg:ml-dashboard-sidebar'}`}>
          <PhoneTopBar
            title={getDashboardPageTitle(pathname)}
            person={shellData.person}
            unread={unread}
            items={phoneMenuItems}
            searchSlot={phoneSearchSlot}
            defaultMenuOpen={initialOverlay === 'phone-menu'}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-dashboard-content px-dashboard-gutter pb-[calc(var(--shell-bottom-offset)+env(safe-area-inset-bottom)+2rem)] pt-6 outline-none md:pb-10 lg:pt-10"
          >
            {children}
          </main>
        </div>
        <BottomBar
          capabilities={shellData.capabilities}
          pathname={pathname}
          moreOpen={moreOpen}
          onOpenMore={() => setMoreOpen(true)}
          hidden={bottomBarHidden}
        />
        <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More" side="bottom">
          <SidebarContent variant="sheet" {...contentProps} onNavigate={() => setMoreOpen(false)} />
        </Sheet>
        <WhatsNewDialog open={dialog === 'whats-new'} onClose={() => setDialog(null)} entries={links.changelog} changelogUrl={links.changelogUrl} />
        <ShareFeedbackDialog open={dialog === 'feedback'} onClose={() => setDialog(null)} onSend={actions.sendFeedback} />
        <AlertDialog
          open={confirmSignOut}
          title="Some changes haven't uploaded yet. Sign out anyway?"
          description="They'll be lost from this device."
          cancelLabel="Stay signed in"
          confirmLabel="Sign out anyway"
          pending={signingOut}
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={() => void signOutNow()}
        />
        <SignedOutDialog open={signedOut} signInHref={signInHref} />
      </div>
    </ShellChromeProvider>
  )
}
