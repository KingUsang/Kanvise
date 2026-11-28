'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { AlertTriangle, CheckCircle2, MailX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'
import {
  confirmUnsubscribe,
  lookupUnsubscribe,
  takeUnsubscribeToken,
  undoUnsubscribe,
  type UnsubscribeAnswer,
} from '@/lib/unsubscribe'

export type UnsubscribePreview = 'loading' | 'confirm' | 'busy' | 'success' | 'undone' | 'expired' | 'error'

type View =
  | { kind: 'loading' }
  | { kind: 'confirm'; label: string; busy?: boolean }
  | { kind: 'success'; label: string; busy?: boolean }
  | { kind: 'undone'; label: string }
  | { kind: 'expired' }
  | { kind: 'error' }

function previewView(state: UnsubscribePreview, label: string): View {
  switch (state) {
    case 'loading': return { kind: 'loading' }
    case 'confirm': return { kind: 'confirm', label }
    case 'busy': return { kind: 'confirm', label, busy: true }
    case 'success': return { kind: 'success', label }
    case 'undone': return { kind: 'undone', label }
    case 'expired': return { kind: 'expired' }
    case 'error': return { kind: 'error' }
  }
}

export function UnsubscribeView({ preview, previewLabel }: { preview?: UnsubscribePreview; previewLabel?: string }) {
  const [view, setView] = useState<View>(() => preview ? previewView(preview, previewLabel || 'lesson reminder') : { kind: 'loading' })
  const token = useRef<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  const show = useCallback((answer: UnsubscribeAnswer) => {
    if (answer.state === 'expired') setView({ kind: 'expired' })
    else if (answer.state === 'unsubscribed') setView({ kind: 'success', label: answer.row_label })
    else setView({ kind: 'confirm', label: answer.row_label })
  }, [])

  const run = useCallback(async (request: (token: string) => Promise<UnsubscribeAnswer>, after?: (answer: UnsubscribeAnswer) => void) => {
    const current = token.current
    if (!current) return setView({ kind: 'expired' })
    try {
      const answer = await request(current)
      if (after) after(answer)
      else show(answer)
    } catch {
      setView({ kind: 'error' })
    }
  }, [show])

  useEffect(() => {
    if (preview) return
    token.current = takeUnsubscribeToken()
    // Lookup only: nothing changes until the person presses Unsubscribe.
    void run(lookupUnsubscribe)
  }, [preview, run])

  // Move focus to the new heading so screen readers hear each change.
  const previousKind = useRef(view.kind)
  useEffect(() => {
    if (previousKind.current !== view.kind && view.kind !== 'loading') heading.current?.focus()
    previousKind.current = view.kind
  }, [view.kind])

  const retry = () => {
    if (preview) return
    setView({ kind: 'loading' })
    void run(lookupUnsubscribe)
  }
  const unsubscribe = (label: string) => {
    if (preview) return
    setView({ kind: 'confirm', label, busy: true })
    void run(confirmUnsubscribe)
  }
  const undo = (label: string) => {
    if (preview) return
    setView({ kind: 'success', label, busy: true })
    void run(undoUnsubscribe, (answer) => {
      if (answer.state === 'subscribed') setView({ kind: 'undone', label: answer.row_label })
      else show(answer)
    })
  }

  return (
    <main className="flex min-h-dvh flex-col items-center bg-dashboard-page px-dashboard-gutter py-10 text-dashboard-foreground sm:justify-center sm:py-16">
      <div className="w-full max-w-[440px]">
        <Link href="/" aria-label="Kanvise home" className="mx-auto mb-8 flex min-h-11 min-w-11 w-fit items-center justify-center rounded-dashboard-control">
          <Image src="/kanvise_logo_small_blue.png" alt="" width={44} height={40} className="h-10 w-auto" priority />
        </Link>
        <section
          aria-live="polite"
          className="rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface px-5 py-7 text-center sm:px-8 sm:py-9"
        >
          {view.kind === 'loading' ? (
            <SkeletonGroup label="Loading your email settings" className="flex flex-col items-center">
              <Skeleton className="size-12 rounded-full" />
              <Skeleton className="mt-5 h-6 w-56 max-w-full" />
              <Skeleton className="mt-6 h-11 w-full sm:w-40" />
            </SkeletonGroup>
          ) : null}

          {view.kind === 'confirm' ? (
            <>
              <StateIcon tone="neutral" />
              <Heading ref={heading}>Stop {view.label} emails?</Heading>
              <div className="mt-6 flex justify-center">
                <Button fullWidthMobile pending={view.busy} pendingLabel="Unsubscribing…" onClick={() => unsubscribe(view.label)}>
                  Unsubscribe
                </Button>
              </div>
            </>
          ) : null}

          {view.kind === 'success' ? (
            <>
              <StateIcon tone="done" />
              <Heading ref={heading}>You won&apos;t get {view.label} emails any more.</Heading>
              <div className="mt-6 flex justify-center">
                <Button variant="outline" fullWidthMobile pending={view.busy} pendingLabel="Undoing…" onClick={() => undo(view.label)}>
                  Undo
                </Button>
              </div>
            </>
          ) : null}

          {view.kind === 'undone' ? (
            <>
              <StateIcon tone="done" />
              <Heading ref={heading}>You&apos;ll get {view.label} emails again.</Heading>
            </>
          ) : null}

          {view.kind === 'expired' ? (
            <>
              <StateIcon tone="neutral" />
              <Heading ref={heading}>This link has expired.</Heading>
              <p className="mt-2 text-dashboard-body text-dashboard-muted">Sign in to manage your notifications.</p>
              <div className="mt-6 flex justify-center">
                <Link
                  href="/auth/login"
                  className="dashboard-press inline-flex min-h-11 w-full items-center justify-center rounded-dashboard-control bg-dashboard-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-dashboard-primary/90 sm:w-auto"
                >
                  Sign in
                </Link>
              </div>
            </>
          ) : null}

          {view.kind === 'error' ? (
            <>
              <StateIcon tone="problem" />
              <Heading ref={heading}>We couldn&apos;t update this.</Heading>
              <p className="mt-2 text-dashboard-body text-dashboard-muted">Try again in a moment.</p>
              <div className="mt-6 flex justify-center">
                <Button variant="outline" fullWidthMobile onClick={retry}>Try again</Button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function StateIcon({ tone }: { tone: 'neutral' | 'done' | 'problem' }) {
  const Icon = tone === 'done' ? CheckCircle2 : tone === 'problem' ? AlertTriangle : MailX
  const colours = tone === 'done'
    ? 'bg-dashboard-success-surface text-dashboard-success'
    : tone === 'problem'
      ? 'bg-dashboard-danger-surface text-dashboard-danger'
      : 'bg-dashboard-surface-subtle text-dashboard-primary'
  return (
    <span aria-hidden="true" className={`mx-auto mb-4 flex size-12 items-center justify-center rounded-full ${colours}`}>
      <Icon className="size-6" />
    </span>
  )
}

function Heading({ children, ref }: { children: ReactNode; ref: Ref<HTMLHeadingElement> }) {
  return (
    // Focus moves here on each change for screen readers; it needs no ring
    // because it isn't something to press.
    <h1 ref={ref} tabIndex={-1} style={{ outline: 'none' }} className="text-dashboard-section-title font-semibold leading-snug text-dashboard-foreground outline-none sm:text-xl">
      {children}
    </h1>
  )
}
