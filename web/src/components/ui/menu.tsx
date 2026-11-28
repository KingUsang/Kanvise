'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { nextMenuIndex } from '@/lib/menu-navigation'
import { actionControlClassName, type ActionControlVariant } from '@/components/dashboard/action-controls'

export type MenuItem =
  | {
      type?: 'item'
      label: string
      /** Called when the item is chosen. Focus returns to the menu button first. */
      onSelect?: () => void
      /** Internal route or external URL. External links open in a new tab. */
      href?: string
      external?: boolean
      icon?: ReactNode
      /** Small trailing detail such as a "New" badge. */
      detail?: ReactNode
      tone?: 'default' | 'danger' | 'subtle'
      disabled?: boolean
    }
  | { type: 'separator' }

const placementClasses = {
  'bottom-end': 'right-0 top-full mt-1',
  'bottom-start': 'left-0 top-full mt-1',
  'top-start': 'bottom-full left-0 mb-1',
  'top-end': 'bottom-full right-0 mb-1',
} as const

const toneClasses = {
  default: 'text-dashboard-foreground',
  danger: 'text-dashboard-danger',
  subtle: 'text-dashboard-small text-dashboard-muted',
} as const

/**
 * WAI-ARIA menu button. Enter, Space or ArrowDown opens on the first item,
 * ArrowUp on the last; arrows, Home and End move; Escape closes and returns
 * focus to the button; Tab or a click outside closes.
 */
export function Menu({
  label,
  trigger,
  items,
  header,
  placement = 'bottom-end',
  triggerVariant = 'quiet',
  triggerClassName,
  iconOnly = true,
  defaultOpen = false,
  menuClassName = '',
  className = '',
}: {
  /** Accessible name of the menu button, and of the menu. */
  label: string
  /** Visible button content (an icon for the ⋯ menu). */
  trigger: ReactNode
  items: MenuItem[]
  /** Non-interactive content at the top, for example name and email. */
  header?: ReactNode
  placement?: keyof typeof placementClasses
  triggerVariant?: ActionControlVariant
  triggerClassName?: string
  /** True when `trigger` has no visible text, so `label` names the button. */
  iconOnly?: boolean
  /** Open on first render (design previews and tests). */
  defaultOpen?: boolean
  /** Extra classes for the menu panel, for example a fixed width. */
  menuClassName?: string
  /** Classes for the wrapper, for example `flex-1 min-w-0` for a full-width trigger. */
  className?: string
}) {
  const id = useId()
  const buttonId = `${id}-button`
  const menuId = `${id}-menu`
  const [open, setOpen] = useState(defaultOpen)
  const [initialFocus, setInitialFocus] = useState<'first' | 'last'>('first')
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const menuItems = useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []),
    [],
  )

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const list = menuItems()
    list[initialFocus === 'first' ? 0 : list.length - 1]?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, initialFocus, close, menuItems])

  const openMenu = (focus: 'first' | 'last') => {
    setInitialFocus(focus)
    setOpen(true)
  }

  const onButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMenu('first')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu('last')
    }
  }

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    if (event.key === 'Tab') {
      close(false)
      return
    }
    const list = menuItems()
    const next = nextMenuIndex(list.length, list.indexOf(document.activeElement as HTMLElement), event.key)
    if (next === null) return
    event.preventDefault()
    list[next]?.focus()
  }

  const itemClass = 'flex min-h-11 w-full items-center gap-3 rounded-dashboard-control px-3 text-left text-dashboard-small font-medium outline-none hover:bg-dashboard-surface-hover focus-visible:bg-dashboard-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-dashboard-focus aria-disabled:cursor-not-allowed aria-disabled:opacity-60'

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`.trim()}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-label={iconOnly ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openMenu('first'))}
        onKeyDown={onButtonKeyDown}
        className={triggerClassName ?? actionControlClassName({ variant: triggerVariant, size: iconOnly ? 'icon' : 'default' })}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={`animate-dashboard-menu-in absolute z-50 min-w-56 rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface p-1.5 shadow-dashboard-overlay ${placementClasses[placement]} ${menuClassName}`}
        >
          {header ? <div className="border-b border-dashboard-outline px-3 pb-2 pt-1.5">{header}</div> : null}
          {items.map((item, index) => {
            if (item.type === 'separator') return <div key={`sep-${index}`} role="separator" className="my-1 h-px bg-dashboard-outline" />
            const content = (
              <>
                {item.icon ? <span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center text-dashboard-muted">{item.icon}</span> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.detail ? <span className="shrink-0">{item.detail}</span> : null}
                {item.external ? <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-dashboard-muted" /> : null}
              </>
            )
            const className = `${itemClass} ${toneClasses[item.tone ?? 'default']}`
            const choose = () => {
              if (item.disabled) return
              close(!item.href)
              item.onSelect?.()
            }
            if (item.href && !item.disabled) {
              if (item.external) {
                return (
                  <a key={item.label} role="menuitem" tabIndex={-1} href={item.href} target="_blank" rel="noopener noreferrer" className={className} onClick={choose}>
                    {content}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )
              }
              return <Link key={item.label} role="menuitem" tabIndex={-1} href={item.href} className={className} onClick={choose}>{content}</Link>
            }
            return (
              <button key={item.label} type="button" role="menuitem" tabIndex={-1} aria-disabled={item.disabled || undefined} className={className} onClick={choose}>
                {content}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
