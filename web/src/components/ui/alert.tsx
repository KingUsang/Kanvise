import type { HTMLAttributes } from 'react'

export type AlertTone = 'danger' | 'warning' | 'success' | 'info'

const toneClasses: Record<AlertTone, string> = {
  danger: 'border-dashboard-danger/30 bg-dashboard-danger/5 text-dashboard-danger',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-dashboard-primary/20 bg-dashboard-primary/5 text-dashboard-foreground',
}

/** Inline message. Danger uses role="alert"; other tones announce politely. */
export function Alert({ tone = 'danger', className = '', ...props }: HTMLAttributes<HTMLDivElement> & { tone?: AlertTone }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      {...props}
      className={`rounded-dashboard-control border px-4 py-3 text-sm ${toneClasses[tone]} ${className}`.trim()}
    />
  )
}
