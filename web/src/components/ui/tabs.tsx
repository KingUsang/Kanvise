'use client'

import Link from 'next/link'
import { useRef, type ReactNode } from 'react'

export type TabItem = { id: string; label: string; badge?: ReactNode }
export type TabLinkItem = { href: string; label: string; badge?: ReactNode }

const stripClassName = 'dashboard-scroll-fade no-scrollbar -mb-px flex min-w-0 max-w-full gap-1 overflow-x-auto'
const tabClassName = 'relative inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-dashboard-small font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-dashboard-focus'

function tabStateClass(active: boolean) {
  return active ? 'text-dashboard-foreground' : 'text-dashboard-muted hover:text-dashboard-foreground'
}

function Underline({ active }: { active: boolean }) {
  return active ? <span aria-hidden="true" data-underline="" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-dashboard-location" /> : null
}

export function tabIds(idPrefix: string, id: string) {
  return { tab: `${idPrefix}-tab-${id}`, panel: `${idPrefix}-panel-${id}` }
}

/**
 * In-page underline tabs (WAI-ARIA tabs, automatic activation). The active
 * tab is underlined with the location colour (SH-03). On narrow screens the
 * strip scrolls sideways inside itself with an edge fade (R-04).
 */
export function UnderlineTabs({ label, items, value, onChange, idPrefix }: {
  label: string
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  idPrefix: string
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (index + 1) % items.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    if (next === null) return
    event.preventDefault()
    const target = items[next]
    onChange(target.id)
    refs.current[target.id]?.focus()
    refs.current[target.id]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }
  return (
    <div className="border-b border-dashboard-outline">
      <div role="tablist" aria-label={label} className={stripClassName}>
        {items.map((item, index) => {
          const active = item.id === value
          const ids = tabIds(idPrefix, item.id)
          return (
            <button
              key={item.id}
              ref={(node) => { refs.current[item.id] = node }}
              type="button"
              role="tab"
              id={ids.tab}
              aria-selected={active}
              aria-controls={ids.panel}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`${tabClassName} ${tabStateClass(active)}`}
            >
              {item.label}
              {item.badge}
              <Underline active={active} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TabPanel({ idPrefix, id, active, children }: { idPrefix: string; id: string; active: boolean; children: ReactNode }) {
  const ids = tabIds(idPrefix, id)
  return (
    <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab} hidden={!active} tabIndex={0} className="outline-none focus-visible:outline-2 focus-visible:outline-dashboard-focus">
      {active ? children : null}
    </div>
  )
}

/**
 * Route-changing variant: real links in a labelled nav, the current one
 * marked with aria-current="page" (standard 07: links when changing history).
 */
export function UnderlineTabLinks({ label, items, currentHref }: { label: string; items: TabLinkItem[]; currentHref: string }) {
  return (
    <nav aria-label={label} className="border-b border-dashboard-outline">
      <div className={stripClassName}>
        {items.map((item) => {
          const active = item.href === currentHref
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`${tabClassName} ${tabStateClass(active)}`}>
              {item.label}
              {item.badge}
              <Underline active={active} />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
