import type { ReactNode } from 'react'

export type PageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  breadcrumb?: ReactNode
  actions?: ReactNode
  supportingAction?: ReactNode
  className?: string
}

/**
 * The shared hierarchy for dashboard routes. The shell owns page gutters;
 * this component owns only the header's internal rhythm. Actions wrap on
 * narrow screens instead of relying on a fixed two-column grid.
 */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  supportingAction,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}>
      <div className="min-w-0">
        {breadcrumb ? <div className="mb-2 text-sm text-dashboard-muted">{breadcrumb}</div> : null}
        <h1 className="break-words text-dashboard-page-title font-bold text-dashboard-foreground sm:text-dashboard-page-title-desktop">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-dashboard-muted sm:text-base">{description}</p> : null}
        {supportingAction ? <div className="mt-2">{supportingAction}</div> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">{actions}</div> : null}
    </header>
  )
}

/**
 * Backwards-compatible name for dashboard pages that have not migrated to the
 * canonical PageHeader contract yet.
 */
export function DashboardPageHeader(props: PageHeaderProps) {
  return <PageHeader {...props} />
}

export type WorkspaceHeaderProps = {
  title: ReactNode
  description?: ReactNode
  back?: ReactNode
  status?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

/**
 * Entity-workspace variant of PageHeader. It keeps the back path, title,
 * status, contextual action, and peer controls in one responsive hierarchy.
 */
export function WorkspaceHeader({
  title,
  description,
  back,
  status,
  actions,
  children,
  className = '',
}: WorkspaceHeaderProps) {
  return (
    <header className={`min-w-0 ${className}`.trim()}>
      {back ? <div className="mb-3 min-w-0 text-sm font-semibold text-dashboard-muted">{back}</div> : null}
      <div className="flex min-w-0 flex-col gap-4 border-b border-dashboard-outline pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-dashboard-page-title font-bold tracking-tight text-dashboard-foreground sm:text-dashboard-page-title-desktop">{title}</h1>
            {status ? <span className="shrink-0 rounded-full border border-dashboard-outline bg-dashboard-surface-subtle px-2.5 py-1 text-[11px] font-bold text-dashboard-foreground">{status}</span> : null}
          </div>
          {description ? <p className="mt-1.5 max-w-3xl text-sm text-dashboard-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div> : null}
      </div>
      {children ? <div className="min-w-0">{children}</div> : null}
    </header>
  )
}
