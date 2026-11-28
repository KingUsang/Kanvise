import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './action-controls'
import { EntityIcon, type Entity } from '@/components/ui/entity-icon'

export function PageLoadingState({ label }: { label: string }) {
  return (
    <section
      role="status"
      aria-busy="true"
      aria-label={label}
      className="motion-safe:animate-pulse motion-reduce:animate-none rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface p-12 text-center"
    >
      <div className="mx-auto h-5 w-40 rounded bg-dashboard-surface-subtle" />
      <div className="mx-auto mt-3 h-3 w-64 max-w-full rounded bg-dashboard-surface-subtle" />
      <div className="mx-auto mt-8 h-11 w-full max-w-md rounded-dashboard-control bg-dashboard-surface-subtle" />
    </section>
  )
}

export function SectionLoadingState({ label, cards = 3 }: { label: string; cards?: number }) {
  return (
    <section
      role="status"
      aria-busy="true"
      aria-label={label}
      className="motion-safe:animate-pulse motion-reduce:animate-none mt-6 rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card"
    >
      <div className="border-b border-dashboard-outline px-5 py-5 sm:px-6">
        <div className="h-3 w-24 rounded bg-dashboard-surface-subtle" />
        <div className="mt-3 h-6 w-48 max-w-full rounded bg-dashboard-surface-subtle" />
        <div className="mt-3 h-4 w-80 max-w-full rounded bg-dashboard-surface-subtle" />
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="h-28 rounded-dashboard-control bg-dashboard-surface-subtle" />
        ))}
      </div>
    </section>
  )
}

/**
 * Empty state (SH-09): the entity icon in its tinted circle, a title, one or
 * two lines that explain the concept, and one primary button. Pass `entity`
 * for the redesign look; `icon` keeps the older square treatment.
 */
export function EmptyState({ icon, entity, title, body, action }: {
  icon?: ReactNode
  entity?: Entity
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <section className="flex min-h-[250px] flex-col items-center justify-center rounded-dashboard-panel border border-dashed border-dashboard-outline bg-dashboard-surface px-5 py-10 text-center">
      {entity
        ? <EntityIcon entity={entity} size="lg" />
        : <div className="flex h-12 w-12 items-center justify-center rounded-dashboard-control bg-dashboard-primary/10 text-dashboard-primary">{icon}</div>}
      <h2 className="mt-4 text-base font-bold text-dashboard-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-dashboard-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  )
}

const errorStateClasses = {
  page: 'rounded-dashboard-panel border border-dashboard-danger/30 bg-dashboard-danger/5 px-6 py-16 text-center text-sm text-dashboard-danger',
  compact: 'mb-4 rounded-dashboard-panel border border-dashboard-danger/30 bg-dashboard-danger/5 px-4 py-3 text-sm text-dashboard-danger',
  // SH-09: the card that failed says so; the rest of the page keeps working.
  card: 'flex flex-col items-center justify-center gap-3 rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface px-5 py-8 text-center text-dashboard-small text-dashboard-foreground',
} as const

export function ErrorState({ message = "We couldn't load this.", onRetry, size = 'page' }: {
  message?: string
  onRetry: () => void
  size?: keyof typeof errorStateClasses
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={errorStateClasses[size]}
    >
      {size === 'card' ? <AlertTriangle aria-hidden="true" className="size-5 text-dashboard-danger" /> : null}
      <p>{message}</p>
      <Button variant="secondary" onClick={onRetry} className={size === 'page' ? 'mt-4' : size === 'compact' ? 'mt-3' : undefined}>
        Try again
      </Button>
    </div>
  )
}

/**
 * SH-09: if data was already on screen when a refresh failed, it stays, with
 * this small warning line above it instead of an error card.
 */
export function StaleDataNotice({ message = "We couldn't refresh this. You're seeing what was loaded before.", onRetry }: {
  message?: string
  onRetry: () => void
}) {
  return (
    <p role="status" className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-dashboard-secondary text-dashboard-warning">
      <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center font-semibold text-dashboard-primary underline underline-offset-2">Try again</button>
    </p>
  )
}

export function RefreshNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="mb-4 flex flex-wrap items-center gap-2 rounded-dashboard-panel border border-dashboard-accent/30 bg-dashboard-accent/10 px-4 py-3 text-sm text-dashboard-foreground">
      <span>{message}</span>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
