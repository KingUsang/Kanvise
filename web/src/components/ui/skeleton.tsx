import type { HTMLAttributes, ReactNode } from 'react'

/**
 * Placeholder shaped like the real content, with a soft shimmer (SH-09).
 * Decorative: wrap a group of skeletons in one element with role="status",
 * aria-busy and a label such as "Loading lessons".
 */
export function Skeleton({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" {...props} className={`dashboard-shimmer animate-dashboard-shimmer rounded-dashboard-control ${className}`.trim()} />
}

/** Labelled loading group for skeletons. */
export function SkeletonGroup({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  )
}

/**
 * Thin progress line along the top of the content area (SH-09). With the
 * default `absolute` position the parent needs `relative`; `fixed` pins it
 * to the top of the window.
 */
export function TopProgressLine({ progress, label = 'Loading page', position = 'absolute', className = '' }: {
  progress: number
  label?: string
  position?: 'absolute' | 'fixed'
  className?: string
}) {
  const value = Math.round(Math.min(100, Math.max(0, progress)))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={`pointer-events-none ${position === 'fixed' ? 'fixed z-[9999]' : 'absolute z-50'} inset-x-0 top-0 h-0.5 overflow-hidden bg-dashboard-primary/10 ${className}`.trim()}
    >
      <div className="dashboard-progress-fill h-full bg-dashboard-primary" style={{ width: `${value}%` }} />
    </div>
  )
}
