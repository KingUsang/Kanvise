'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Check, ChevronsUpDown, CircleHelp, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import {
  getDashboardNavGroups,
  isActiveNavHref,
  type DashboardNavItem,
} from '@/config/dashboard-navigation'
import { Avatar } from '@/components/ui/avatar'
import { CountBadge } from '@/components/ui/badge'
import { Menu, type MenuItem } from '@/components/ui/menu'
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { navIcons } from './nav-icons'
import { PersonHeader, accountMenuItems, helpMenuItems } from './shell-menus'
import type { ShellAccount, ShellData, ShellLinks, ShellOverlay } from './types'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export type RailState = { tablet: boolean; desktop: boolean }

/*
 * The desktop sidebar is a 64px icon rail at some widths and 264px at others.
 * Layout follows CSS breakpoints so nothing jumps while the page loads; these
 * classes apply only at the widths where the rail is showing.
 */
function railClasses(variant: 'sidebar' | 'sheet', rail: RailState) {
  if (variant === 'sheet') return { hideInRail: '', onlyInRail: 'hidden', srInRail: '', centreInRail: '', plainInRail: '', stackInRail: '' }
  const t = rail.tablet
  const d = rail.desktop
  return {
    hideInRail: cx(t && 'md:max-lg:hidden', d && 'lg:hidden'),
    onlyInRail: cx('max-md:hidden', !t && 'md:max-lg:hidden', !d && 'lg:hidden'),
    srInRail: cx(t && 'md:max-lg:sr-only', d && 'lg:sr-only'),
    centreInRail: cx(t && 'md:max-lg:justify-center md:max-lg:px-0', d && 'lg:justify-center lg:px-0'),
    plainInRail: cx(t && 'md:max-lg:border-transparent md:max-lg:bg-transparent', d && 'lg:border-transparent lg:bg-transparent'),
    stackInRail: cx(t && 'md:max-lg:flex-col', d && 'lg:flex-col'),
  }
}

type RailClasses = ReturnType<typeof railClasses>

const smallCaps = 'text-xs font-semibold uppercase tracking-[0.12em] text-dashboard-muted'
const focusRing = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-focus'

const roleLabels: Record<ShellAccount['role'], string> = { admin: 'Admin', tutor: 'Tutor', learner: 'Student' }

function AccountMark({ account }: { account: ShellAccount }) {
  if (account.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- agency logos come from user storage
    return <img src={account.logoUrl} alt="" className="size-5 rounded object-cover" />
  }
  return <span className="flex size-5 items-center justify-center rounded bg-dashboard-entity-lesson-tint text-[11px] font-semibold text-dashboard-entity-lesson">{account.name.trim()[0]?.toUpperCase() ?? '?'}</span>
}

function AccountCard({ data, r, defaultOpen, onSwitch }: {
  data: ShellData
  r: RailClasses
  defaultOpen: boolean
  onSwitch: (account: ShellAccount) => void
}) {
  if (data.loading && !data.account) {
    return <Skeleton className={cx('h-14 w-full rounded-dashboard-panel', r.hideInRail)} />
  }
  if (!data.account) return null
  const independent = data.capabilities.organisationType === 'independent'
  const name = data.account.name
  const avatar = independent
    ? <Avatar name={data.person.name} src={data.person.photoUrl} size="md" />
    : <Avatar name={name} src={data.account.logoUrl} size="md" shape="square" />
  const body = (
    <>
      {avatar}
      <span className={cx('min-w-0 flex-1 text-left', r.srInRail)}>
        <span className="block whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-dashboard-muted">{independent ? 'Your tutoring' : 'Tutoring agency'}</span>
        <span className="line-clamp-2 break-words text-dashboard-small font-semibold leading-5 text-dashboard-foreground" title={name}>{name}</span>
      </span>
    </>
  )
  const card = cx('flex min-h-14 w-full min-w-0 items-center gap-3 rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface px-3 py-2', r.centreInRail, r.plainInRail)
  if (data.accounts.length < 2) return <div className={card}>{body}</div>

  const currentId = data.account.id
  const items: MenuItem[] = data.accounts.map((account) => ({
    label: account.name,
    icon: <AccountMark account={account} />,
    detail: (
      <span className="flex items-center gap-2 text-dashboard-secondary text-dashboard-muted">
        {roleLabels[account.role]}
        {account.id === currentId
          ? <><Check aria-hidden="true" className="size-4 text-dashboard-primary" /><span className="sr-only">(current)</span></>
          : <span aria-hidden="true" className="size-4" />}
      </span>
    ),
    onSelect: account.id === currentId ? undefined : () => onSwitch(account),
  }))
  return (
    <Menu
      label="Switch tutoring account"
      iconOnly={false}
      className="w-full"
      menuClassName="w-80"
      placement="bottom-start"
      defaultOpen={defaultOpen}
      header={<p className={smallCaps}>Your tutoring accounts</p>}
      items={items}
      triggerClassName={cx(card, 'text-left hover:bg-dashboard-surface-hover', focusRing)}
      trigger={
        <>
          {body}
          <span className="sr-only">, switch tutoring account</span>
          <ChevronsUpDown aria-hidden="true" className={cx('size-4 shrink-0 text-dashboard-muted', r.hideInRail)} />
        </>
      }
    />
  )
}

function NavLink({ item, active, r, tooltips, badge, onNavigate }: {
  item: DashboardNavItem
  active: boolean
  r: RailClasses
  tooltips: boolean
  badge: number | null
  onNavigate?: () => void
}) {
  const Icon = navIcons[item.icon]
  const count = badge ?? 0
  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cx(
        'relative flex min-h-11 w-full items-center gap-3 rounded-dashboard-control px-3 text-dashboard-small lg:min-h-10',
        focusRing,
        active
          ? 'bg-dashboard-surface-hover font-semibold text-dashboard-foreground'
          : 'font-medium text-dashboard-muted hover:bg-dashboard-surface-hover hover:text-dashboard-foreground',
        r.centreInRail,
      )}
    >
      {active ? <span data-location-bar="" aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-dashboard-location" /> : null}
      <span className="relative inline-flex">
        <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
        {count > 0 ? <span aria-hidden="true" className={cx('absolute -right-1 -top-1 size-2 rounded-full bg-dashboard-primary', r.onlyInRail)} /> : null}
      </span>
      <span className={cx('min-w-0 flex-1 truncate', r.srInRail)}>{item.label}</span>
      {item.badge === 'ungradedQuizzes' ? <CountBadge count={count} label={`${count} to mark`} className={r.hideInRail} /> : null}
      {item.badge === 'ungradedQuizzes' && count > 0 ? <span className={cx('sr-only', r.onlyInRail)}>{`, ${count} to mark`}</span> : null}
    </Link>
  )
  if (!tooltips) return link
  return <Tooltip content={item.label} side="right" describes={false} className="flex w-full">{link}</Tooltip>
}

function NavSkeleton({ r }: { r: RailClasses }) {
  return (
    <SkeletonGroup label="Loading the menu" className="space-y-2 px-1 pt-2">
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className={cx('flex items-center gap-3 px-2', r.centreInRail)}>
          <Skeleton className="size-5 shrink-0 rounded-md" />
          <Skeleton className={cx('h-3.5 flex-1', r.hideInRail)} />
        </div>
      ))}
    </SkeletonGroup>
  )
}

export type SidebarContentProps = {
  variant: 'sidebar' | 'sheet'
  rail?: RailState
  /** True once the rail is known to be showing, so labels become tooltips. */
  tooltips?: boolean
  data: ShellData
  pathname: string
  links: ShellLinks
  unread: boolean
  signingOut: boolean
  initialOverlay?: ShellOverlay
  /** Search field for the sidebar; a function receives the rail classes. Not shown in the phone More sheet, which has search in the top bar. */
  searchSlot?: ReactNode | ((rail: { srInRail: string; hideInRail: string; centreInRail: string; tooltips: boolean }) => ReactNode)
  onNavigate?: () => void
  onSwitchAccount: (account: ShellAccount) => void
  onOpenWhatsNew: () => void
  onOpenFeedback?: () => void
  onSignOut: () => void
}

/**
 * Sidebar content, top to bottom (SH-02): account card, search slot, setup
 * card slot (hidden in build step 1), grouped navigation, user card. The
 * phone More sheet shows the same content (SH-16).
 */
export function SidebarContent({
  variant,
  rail = { tablet: false, desktop: false },
  tooltips = false,
  data,
  pathname,
  links,
  unread,
  signingOut,
  initialOverlay,
  searchSlot,
  onNavigate,
  onSwitchAccount,
  onOpenWhatsNew,
  onOpenFeedback,
  onSignOut,
}: SidebarContentProps) {
  const r = railClasses(variant, rail)
  const groups = getDashboardNavGroups(data.capabilities)
  const independent = data.capabilities.organisationType === 'independent'
  const roleWord = data.capabilities.isAdmin ? 'Admin' : 'Tutor'
  const secondLine = independent || !data.account ? (independent ? data.person.email : roleWord) : `${roleWord} · ${data.account.name}`

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cx('space-y-3', variant === 'sidebar' ? 'px-3 pb-2' : 'pb-2')}>
        <AccountCard data={data} r={r} defaultOpen={initialOverlay === 'switcher'} onSwitch={onSwitchAccount} />
        {variant === 'sidebar'
          ? (typeof searchSlot === 'function' ? searchSlot({ srInRail: r.srInRail, hideInRail: r.hideInRail, centreInRail: r.centreInRail, tooltips }) : searchSlot)
          : null}
      </div>

      <nav aria-label="Main" className={cx('min-h-0 flex-1', variant === 'sidebar' ? 'overflow-y-auto px-2 pb-3' : 'pb-3')}>
        {data.loading ? <NavSkeleton r={r} /> : groups.map((group) => {
          const headingId = `nav-group-${variant}-${group.id}`
          return (
            <div key={group.id} className={group.label ? 'mt-3' : 'mt-1'}>
              {group.label ? (
                <>
                  <p id={headingId} className={cx('px-3 pb-1 pt-2', smallCaps, r.hideInRail)}>{group.label}</p>
                  <div aria-hidden="true" className={cx('mx-3 mb-2 h-px bg-dashboard-outline', r.onlyInRail)} />
                </>
              ) : null}
              <ul aria-labelledby={group.label ? headingId : undefined} className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={isActiveNavHref(pathname, item.href)}
                      r={r}
                      tooltips={tooltips}
                      badge={item.badge === 'ungradedQuizzes' ? data.badges.ungradedQuizzes : null}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className={cx('flex items-center gap-1 border-t border-dashboard-outline', variant === 'sidebar' ? 'p-2' : 'pt-3', r.stackInRail)}>
        <Menu
          label="Account menu"
          iconOnly={false}
          className="min-w-0 flex-1"
          menuClassName="w-64"
          placement="top-start"
          defaultOpen={initialOverlay === 'account-menu'}
          header={<PersonHeader name={data.person.name} email={data.person.email} />}
          items={accountMenuItems({ onSignOut, signingOut })}
          triggerClassName={cx('flex min-h-12 w-full min-w-0 items-center gap-3 rounded-dashboard-control px-2 py-1.5 text-left hover:bg-dashboard-surface-hover', focusRing, r.centreInRail)}
          trigger={
            <>
              <Avatar name={data.person.name} src={data.person.photoUrl} size="md" />
              <span className={cx('min-w-0 flex-1', r.srInRail)}>
                <span className="block truncate text-dashboard-small font-semibold text-dashboard-foreground">{data.person.name}</span>
                <span className="block truncate text-dashboard-secondary text-dashboard-muted">{secondLine}</span>
              </span>
            </>
          }
        />
        <Menu
          label={unread ? 'Help, new updates' : 'Help'}
          placement={tooltips ? 'top-start' : 'top-end'}
          menuClassName="w-60"
          defaultOpen={initialOverlay === 'help'}
          items={helpMenuItems({ unread, helpUrl: links.helpUrl, onWhatsNew: onOpenWhatsNew, onFeedback: onOpenFeedback })}
          trigger={
            <span className="relative inline-flex">
              <CircleHelp aria-hidden="true" className="size-5" />
              {unread ? <span data-unread-dot="" aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-dashboard-info ring-2 ring-dashboard-page" /> : null}
            </span>
          }
        />
      </div>
    </div>
  )
}

export function DesktopSidebar({ collapsed, tabletExpanded, toggleExpanded, onToggle, onCloseTablet, tooltips, ...content }: Omit<SidebarContentProps, 'variant' | 'rail'> & {
  /** Desktop preference: show the rail. */
  collapsed: boolean
  /** Tablet: the rail is expanded over the page. */
  tabletExpanded: boolean
  /** aria-expanded of the collapse button at the current width. */
  toggleExpanded: boolean
  onToggle: () => void
  onCloseTablet: () => void
}) {
  const rail = { tablet: !tabletExpanded, desktop: collapsed }
  const r = railClasses('sidebar', rail)
  return (
    <>
      {tabletExpanded ? <div aria-hidden="true" data-testid="sidebar-scrim" className="fixed inset-0 z-40 hidden bg-dashboard-scrim md:block lg:hidden" onClick={onCloseTablet} /> : null}
      <aside
        id="dashboard-sidebar"
        aria-label="Sidebar"
        className={cx(
          'fixed inset-y-0 left-0 z-50 hidden h-dvh flex-col border-r border-dashboard-outline bg-dashboard-page md:flex',
          tabletExpanded ? 'md:w-dashboard-sidebar md:shadow-dashboard-overlay lg:shadow-none' : 'md:w-dashboard-rail',
          collapsed ? 'lg:w-dashboard-rail' : 'lg:w-dashboard-sidebar',
        )}
      >
        <div className={cx('flex h-14 shrink-0 items-center justify-between gap-2 px-4', r.centreInRail)}>
          <Link href="/dashboard" className={cx('flex items-center gap-2 rounded-dashboard-control', focusRing, r.hideInRail)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark */}
            <img src="/kanvise_logo.jpeg" alt="" className="size-7 rounded-md object-cover" />
            <span className="text-lg font-bold tracking-tight text-dashboard-primary">Kanvise</span>
          </Link>
          <button
            type="button"
            aria-label={toggleExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={toggleExpanded}
            aria-controls="dashboard-sidebar"
            onClick={onToggle}
            className={cx('inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-control text-dashboard-muted hover:bg-dashboard-surface-hover hover:text-dashboard-foreground', focusRing)}
          >
            {toggleExpanded ? <PanelLeftClose aria-hidden="true" className="size-5" /> : <PanelLeftOpen aria-hidden="true" className="size-5" />}
          </button>
        </div>
        <SidebarContent variant="sidebar" rail={rail} tooltips={tooltips} {...content} />
      </aside>
    </>
  )
}
