import type { HTMLAttributes, ReactNode } from 'react'

export type CardPadding = 'none' | 'compact' | 'default'

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  compact: 'p-4',
  default: 'p-5 sm:p-6',
}

export function cardClassName({ padding = 'default', interactive = false, className = '' }: {
  padding?: CardPadding
  interactive?: boolean
  className?: string
} = {}) {
  return [
    'rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface',
    paddingClasses[padding],
    interactive ? 'dashboard-card-lift' : '',
    className,
  ].filter(Boolean).join(' ')
}

/** White surface with a 1px border and the 12px card radius (SH-01). */
export function Card({ padding, interactive, className, ...props }: HTMLAttributes<HTMLDivElement> & {
  padding?: CardPadding
  interactive?: boolean
}) {
  return <div {...props} className={cardClassName({ padding, interactive, className })} />
}

/** A card with a titled header. `actions` sit on the right of the header. */
export function Panel({ title, description, actions, children, headingLevel = 2, className = '', ...props }: Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  headingLevel?: 2 | 3
  children?: ReactNode
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  return (
    <section {...props} className={cardClassName({ padding: 'none', className })}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-dashboard-outline px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <Heading className="text-dashboard-section-title font-semibold text-dashboard-foreground">{title}</Heading>
          {description ? <p className="mt-0.5 text-dashboard-small text-dashboard-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}
