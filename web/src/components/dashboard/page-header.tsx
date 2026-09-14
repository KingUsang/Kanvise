import type { ReactNode } from 'react'

type DashboardPageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  supportingAction?: ReactNode
  className?: string
  titleClassName?: string
}

/**
 * The shared hierarchy for dashboard routes. The shell owns page gutters;
 * this component deliberately owns only the header's internal rhythm.
 */
export function DashboardPageHeader({
  title,
  description,
  eyebrow,
  actions,
  supportingAction,
  className = '',
  titleClassName = 'text-dashboard-foreground',
}: DashboardPageHeaderProps) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}>
      <div>
        {eyebrow ? <p className="text-dashboard-eyebrow font-bold uppercase text-dashboard-accent">{eyebrow}</p> : null}
        <h1 className={`text-dashboard-page-title font-bold sm:text-dashboard-page-title-desktop ${eyebrow ? 'mt-2' : ''} ${titleClassName}`}>{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-dashboard-muted sm:text-base">{description}</p> : null}
        {supportingAction ? <div className="mt-2">{supportingAction}</div> : null}
      </div>
      {actions ? <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">{actions}</div> : null}
    </header>
  )
}
