import type { ReactNode } from 'react'

type DashboardPageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
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
  className = '',
  titleClassName = 'text-[#1b1c1c]',
}: DashboardPageHeaderProps) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}>
      <div>
        {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#994704]">{eyebrow}</p> : null}
        <h1 className={`text-2xl font-bold leading-tight tracking-tight sm:text-3xl ${eyebrow ? 'mt-2' : ''} ${titleClassName}`}>{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-[#474551] sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">{actions}</div> : null}
    </header>
  )
}
