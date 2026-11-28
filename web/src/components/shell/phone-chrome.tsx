'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { getBottomBarArea, getBottomBarTabs, type DashboardCapabilities } from '@/config/dashboard-navigation'
import { Avatar } from '@/components/ui/avatar'
import { Menu, type MenuItem } from '@/components/ui/menu'
import { navIcons } from './nav-icons'
import { PersonHeader } from './shell-menus'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

const focusRing = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-focus'

/**
 * Phone top bar (SH-16, R-02): page title, the search icon (filled by the
 * search feature) and the avatar, which opens the account and help menus.
 */
export function PhoneTopBar({ title, person, unread, items, searchSlot, defaultMenuOpen }: {
  title: string
  person: { name: string; email: string; photoUrl: string | null }
  unread: boolean
  items: MenuItem[]
  searchSlot?: ReactNode
  defaultMenuOpen?: boolean
}) {
  return (
    <header className="sticky top-0 z-30 flex h-dashboard-topbar items-center gap-2 border-b border-dashboard-outline bg-dashboard-page px-dashboard-gutter md:hidden">
      <p className="min-w-0 flex-1 truncate text-dashboard-section-title font-semibold text-dashboard-foreground" title={title}>{title}</p>
      {searchSlot}
      <Menu
        label={unread ? 'Account and help, new updates' : 'Account and help'}
        placement="bottom-end"
        menuClassName="w-64"
        defaultOpen={defaultMenuOpen}
        header={<PersonHeader name={person.name} email={person.email} />}
        items={items}
        triggerClassName={cx('relative inline-flex size-11 items-center justify-center rounded-full', focusRing)}
        trigger={
          <>
            <Avatar name={person.name} src={person.photoUrl} size="sm" />
            {unread ? <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-dashboard-info ring-2 ring-dashboard-page" /> : null}
          </>
        }
      />
    </header>
  )
}

/**
 * Phone bottom bar (R-02, R-10): Today, Calendar, Students when visible, and
 * More, which opens the sidebar as a sheet. The active tab has the location
 * marker above the icon and a bolder label.
 */
export function BottomBar({ capabilities, pathname, moreOpen, onOpenMore, hidden }: {
  capabilities: DashboardCapabilities
  pathname: string
  moreOpen: boolean
  onOpenMore: () => void
  hidden: boolean
}) {
  const tabs = getBottomBarTabs(capabilities)
  const activeArea = moreOpen ? 'more' : getBottomBarArea(pathname)
  return (
    <nav
      aria-label="Bottom bar"
      hidden={hidden}
      data-shell-bottom-bar=""
      className="fixed inset-x-0 bottom-0 z-40 border-t border-dashboard-outline bg-dashboard-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch">
        {tabs.map((tab) => {
          const Icon = navIcons[tab.icon]
          const active = tab.area === activeArea
          const className = cx(
            'relative flex h-full w-full flex-col items-center justify-center gap-1 text-xs',
            focusRing,
            active ? 'font-bold text-dashboard-foreground' : 'font-medium text-dashboard-muted',
          )
          const content = (
            <>
              {active ? <span data-location-bar="" aria-hidden="true" className="absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-dashboard-location" /> : null}
              <Icon aria-hidden="true" className="size-6" strokeWidth={active ? 2.25 : 1.75} />
              <span className="max-w-full truncate px-1">{tab.label}</span>
            </>
          )
          return (
            <li key={tab.area} className="min-w-0 flex-1">
              {tab.href ? (
                <Link href={tab.href} aria-current={active ? 'page' : undefined} className={className}>{content}</Link>
              ) : (
                <button type="button" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={onOpenMore} className={className}>{content}</button>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
