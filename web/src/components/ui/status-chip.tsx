import { Check } from 'lucide-react'

/** Lesson statuses from 01-app-shell SH-15 and SH-12: always a dot or icon plus a word. */
export type LessonStatus = 'planned' | 'starting-soon' | 'live' | 'complete' | 'not-held' | 'cancelled'

const statusConfig: Record<LessonStatus, { label: string; dot: string }> = {
  planned: { label: 'Planned', dot: 'bg-dashboard-status-planned' },
  'starting-soon': { label: 'Starting soon', dot: 'bg-dashboard-status-soon' },
  live: { label: 'Live', dot: 'bg-dashboard-status-live animate-dashboard-live-pulse' },
  complete: { label: 'Complete', dot: '' },
  'not-held': { label: 'Not held', dot: 'bg-dashboard-outline-strong' },
  cancelled: { label: 'Cancelled', dot: 'bg-dashboard-outline-strong' },
}

export function lessonStatusLabel(status: LessonStatus) {
  return statusConfig[status].label
}

/**
 * Status pill with a coloured dot and the status word. Complete uses a
 * neutral chip with a tick (green is reserved for Live and success).
 * `label` overrides the word, for example "Live now".
 */
export function StatusChip({ status, label, className = '' }: { status: LessonStatus; label?: string; className?: string }) {
  const config = statusConfig[status]
  return (
    <span
      data-status={status}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashboard-outline bg-dashboard-surface px-2.5 py-0.5 text-dashboard-secondary font-semibold text-dashboard-foreground ${className}`.trim()}
    >
      {status === 'complete'
        ? <Check aria-hidden="true" className="size-3.5 text-dashboard-muted" strokeWidth={2.5} />
        : <span aria-hidden="true" className={`size-2 rounded-full ${config.dot}`} />}
      {label ?? config.label}
    </span>
  )
}
