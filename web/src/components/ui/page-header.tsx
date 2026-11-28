import type { ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'
import { Button, LinkButton } from '@/components/dashboard/action-controls'
import { Menu, type MenuItem } from './menu'
import { PageTitle } from './page-title'

/** A secondary page action: an outline button on desktop, a ⋯ menu item on phones. */
export type PageAction = { label: string; href?: string; onSelect?: () => void; icon?: ReactNode }

export type RedesignPageHeaderProps = {
  title: ReactNode
  /** One plain line that explains the page (SH-03). Two lines at most on phones. */
  description?: ReactNode
  /** The one indigo primary action, usually a Button or LinkButton. */
  primaryAction?: ReactNode
  /**
   * Phones (R-03): `full-width` puts the primary action under the description;
   * `fab` hides it because the page shows a Fab instead. Never both.
   */
  phonePrimary?: 'full-width' | 'fab'
  /** Outline buttons left of the primary action; in the ⋯ menu on phones. */
  secondaryActions?: PageAction[]
  /** Everything else, always in the ⋯ menu. */
  menuItems?: MenuItem[]
  /** Swatch or avatar before the title (workspace pages). */
  leading?: ReactNode
  /** Status chip after the title (workspace pages). */
  status?: ReactNode
  /** Facts strip under the header, for example Date · Time · Course. */
  facts?: ReactNode[]
  /** Underline tabs below the header. */
  tabs?: ReactNode
  /** Heading level of the title. Keep 1 on real pages; 2 only for previews. */
  titleLevel?: 1 | 2
  className?: string
}

function toMenuItem(action: PageAction): MenuItem {
  return { label: action.label, href: action.href, onSelect: action.onSelect, icon: action.icon }
}

/**
 * Redesign page header (SH-03, R-03). The shell owns the gutters; this owns
 * the header's own rhythm. Existing pages keep `@/components/dashboard/page-header`
 * until they move to the redesign.
 */
export function PageHeader({
  title,
  description,
  primaryAction,
  phonePrimary = 'full-width',
  secondaryActions = [],
  menuItems = [],
  leading,
  status,
  facts,
  tabs,
  titleLevel = 1,
  className = '',
}: RedesignPageHeaderProps) {
  const phoneMenu = [...secondaryActions.map(toMenuItem), ...menuItems]
  return (
    <header className={`min-w-0 ${className}`.trim()}>
      <div className="flex min-w-0 items-start gap-3">
        {leading ? <div className="mt-1 shrink-0 md:mt-1.5">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 md:flex-wrap">
            <PageTitle level={titleLevel}>{title}</PageTitle>
            {status ? <div className="shrink-0">{status}</div> : null}
          </div>
          {description ? <p className="mt-1 max-w-2xl text-dashboard-small text-dashboard-muted max-md:line-clamp-2 md:text-dashboard-body">{description}</p> : null}
        </div>
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          {secondaryActions.map((action) => action.href
            ? <LinkButton key={action.label} href={action.href} variant="outline">{action.icon}{action.label}</LinkButton>
            : <Button key={action.label} variant="outline" onClick={action.onSelect}>{action.icon}{action.label}</Button>)}
          {primaryAction}
          {menuItems.length > 0 ? <Menu label="More actions" trigger={<Ellipsis aria-hidden="true" className="size-5" />} items={menuItems} triggerVariant="outline" /> : null}
        </div>
        {phoneMenu.length > 0 ? (
          <div className="shrink-0 md:hidden">
            <Menu label="More actions" trigger={<Ellipsis aria-hidden="true" className="size-5" />} items={phoneMenu} />
          </div>
        ) : null}
      </div>
      {primaryAction && phonePrimary === 'full-width' ? <div className="mt-3 md:hidden [&>*]:w-full">{primaryAction}</div> : null}
      {facts && facts.length > 0 ? (
        <ul aria-label="Details" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-dashboard-small text-dashboard-muted">
          {facts.map((fact, index) => (
            <li key={index} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              {fact}
            </li>
          ))}
        </ul>
      ) : null}
      {tabs ? <div className="mt-4">{tabs}</div> : null}
    </header>
  )
}

/**
 * Detail page header (SH-03): course swatch or avatar before the title, a
 * status chip after it, a facts strip and underline tabs.
 */
export function WorkspaceHeader(props: RedesignPageHeaderProps & { leading: ReactNode }) {
  return <PageHeader {...props} />
}
