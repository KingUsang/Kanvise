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
