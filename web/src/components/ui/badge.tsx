import type { HTMLAttributes } from 'react'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-dashboard-surface-subtle text-dashboard-muted',
  success: 'bg-green-50 text-green-800',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-dashboard-danger/10 text-dashboard-danger',
  info: 'bg-dashboard-primary/10 text-dashboard-primary',
}

export function badgeClassName(tone: BadgeTone = 'neutral', className = '') {
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClasses[tone]} ${className}`.trim()
}

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span {...props} className={badgeClassName(tone, className)} />
}

/**
 * Pill count for "something needs you" (SH-02), for example Homework 3. The
 * visible number is hidden from assistive tech and `label` carries the full
 * meaning ("3 to mark"). Renders nothing for zero.
 */
export function CountBadge({ count, label, tone = 'primary', className = '' }: {
  count: number
  label: string
  tone?: 'primary' | 'info'
  className?: string
}) {
  if (count <= 0) return null
  const toneClass = tone === 'info' ? 'bg-dashboard-info text-white' : 'bg-dashboard-primary text-white'
  return (
    <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-dashboard-secondary font-bold leading-5 ${toneClass} ${className}`.trim()}>
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
