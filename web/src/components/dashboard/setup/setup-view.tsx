'use client'

import Link from 'next/link'
import { Check, CircleHelp, ExternalLink, Info, X } from 'lucide-react'
import { Button, LinkButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageTitle } from '@/components/ui/page-title'
import { KaviMark } from '@/components/onboarding/kavi-line'
import type { SetupChecklist, SetupRow, SetupStepId } from '@/lib/setup-checklist'

/** Progress bar used by the card and the sidebar (SH-02, SET-01). */
export function SetupProgress({ completed, total, label }: { completed: number; total: number; label: string }) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return (
    <div className="flex items-center gap-3">
      <div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed} aria-valuetext={label} className="h-2 flex-1 overflow-hidden rounded-full bg-dashboard-outline">
        <div className="h-full rounded-full bg-dashboard-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <span className="shrink-0 text-dashboard-secondary text-dashboard-muted">{label}</span>
    </div>
  )
}

function Row({ row, busy, onToggleSkip }: { row: SetupRow; busy: boolean; onToggleSkip: (id: SetupStepId, skipped: boolean) => void }) {
  const finished = row.state !== 'todo'
  return (
    <li data-state={row.state} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-4">
      <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-full ${row.state === 'done' ? 'animate-dashboard-pop bg-dashboard-success-surface text-dashboard-success' : 'bg-dashboard-surface-subtle text-dashboard-muted'}`}>
        {row.state === 'done' ? <Check className="size-5" /> : <span className="text-sm font-semibold">{row.state === 'skipped' ? '–' : ''}</span>}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`text-base font-semibold ${finished ? 'text-dashboard-muted' : 'text-dashboard-foreground'}`}>{row.title}</h3>
          <span className="rounded-full bg-dashboard-surface-subtle px-2 py-0.5 text-dashboard-secondary text-dashboard-muted">{row.time}</span>
          {row.next ? <span className="rounded-full bg-dashboard-primary px-2 py-0.5 text-dashboard-secondary font-semibold text-white">Next</span> : null}
          {row.state === 'skipped' ? <span className="rounded-full bg-dashboard-surface-subtle px-2 py-0.5 text-dashboard-secondary font-semibold text-dashboard-muted">Skipped</span> : null}
        </div>
        <p className={`text-sm ${finished ? 'text-dashboard-muted' : 'text-dashboard-foreground'}`}>{row.reason}</p>
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        {row.state === 'done' ? (
          <Link href={row.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-dashboard-primary underline underline-offset-2">View<span className="sr-only">, {row.title}</span></Link>
        ) : row.state === 'skipped' ? (
          <Button variant="outline" disabled={busy} onClick={() => onToggleSkip(row.id, false)}>Do this step</Button>
        ) : row.disabledReason ? (
          <Button variant={row.next ? 'primary' : 'outline'} disabledReason={row.disabledReason}>{row.button}</Button>
        ) : (
          <LinkButton href={row.href} variant={row.next ? 'primary' : 'outline'}>{row.button}</LinkButton>
        )}
        {row.skippable && row.state === 'todo' ? (
          <button type="button" disabled={busy} onClick={() => onToggleSkip(row.id, true)} className="inline-flex min-h-11 items-center text-sm text-dashboard-muted underline underline-offset-2 hover:text-dashboard-foreground disabled:opacity-60">
            Skip this step
          </button>
        ) : null}
      </div>
    </li>
  )
}

/** ONB-08: shown when saving failed and the person continued with the defaults. */
export function DefaultsBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-dashboard-panel border border-dashboard-info/30 bg-dashboard-info-surface p-4 text-sm text-dashboard-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-dashboard-info" />
      {/* The Teaching preferences link joins this line when Settings ships (build step 3, 12 CFG-T). */}
      <p className="flex-1">We used the default settings.</p>
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className="inline-flex size-8 items-center justify-center rounded-dashboard-control hover:bg-dashboard-surface-hover">
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}

/**
 * SET-01 to SET-03. `checklist` has rows only for steps whose screens have
 * shipped, so the count reads {n}/{rows shown} completed.
 */
export function SetupView({ firstName, checklist, helpUrl, showDefaultsBanner, onDismissBanner, onToggleSkip, busyStep, onFinish }: {
  firstName: string
  checklist: SetupChecklist
  helpUrl?: string
  showDefaultsBanner: boolean
  onDismissBanner: () => void
  onToggleSkip: (id: SetupStepId, skipped: boolean) => void
  busyStep: SetupStepId | null
  /** SET-03: Go to dashboard. */
  onFinish: () => void
}) {
  return (
    <div className="space-y-6">
      <PageTitle>{firstName ? `Welcome to Kanvise, ${firstName}` : 'Welcome to Kanvise'}</PageTitle>
      {showDefaultsBanner ? <DefaultsBanner onDismiss={onDismissBanner} /> : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-5 lg:col-span-2">
          {checklist.allDone ? (
            <div className="space-y-4">
              <KaviMark />
              <h2 className="text-xl font-semibold text-dashboard-foreground">You&apos;re all set.</h2>
              <Button onClick={onFinish}>Go to dashboard</Button>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <KaviMark />
                <div>
                  <h2 className="text-xl font-semibold text-dashboard-foreground">Let&apos;s get your first lesson on the calendar.</h2>
                  <p className="text-sm text-dashboard-muted">A few quick steps and you&apos;re ready to teach.</p>
                </div>
              </div>
              <SetupProgress completed={checklist.completed} total={checklist.total} label={checklist.label} />
              <ul className="divide-y divide-dashboard-outline">
                {checklist.rows.map((row) => <Row key={row.id} row={row} busy={busyStep === row.id} onToggleSkip={onToggleSkip} />)}
              </ul>
            </>
          )}
        </Card>
        {helpUrl ? (
          <Card className="h-fit space-y-3">
            <h2 className="text-base font-semibold text-dashboard-foreground">Get started with confidence</h2>
            <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-dashboard-primary underline underline-offset-2">
              <CircleHelp aria-hidden="true" className="size-4" />Visit the help guide<ExternalLink aria-hidden="true" className="size-4" /><span className="sr-only">(opens in a new tab)</span>
            </a>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
