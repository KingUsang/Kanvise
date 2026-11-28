'use client'

import { cloneElement, useEffect, useId, useState, type ReactElement, type ReactNode } from 'react'

type TriggerProps = {
  'aria-describedby'?: string
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void
}

const sideClasses = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
} as const

const TAP_VISIBLE_MS = 2500

/**
 * Short hint shown on hover, keyboard focus and tap (SH-12). Escape hides it.
 * Never put the only copy of important information here. Use
 * `describes={false}` when the text already is the trigger's accessible name
 * (for example the collapsed sidebar rail), so it is not read twice.
 */
export function Tooltip({ content, children, side = 'top', describes = true, className = '' }: {
  content: ReactNode
  children: ReactElement<TriggerProps>
  side?: keyof typeof sideClasses
  describes?: boolean
  /** Wrapper classes, for example `flex w-full` around a full-width link. */
  className?: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  // Counts taps so each tap restarts the auto-hide timer.
  const [tap, setTap] = useState(0)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (tap === 0) return
    const timer = setTimeout(() => setOpen(false), TAP_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [tap])

  const trigger = cloneElement(children, {
    'aria-describedby': describes ? [children.props['aria-describedby'], id].filter(Boolean).join(' ') : children.props['aria-describedby'],
    onFocus: (event) => {
      children.props.onFocus?.(event)
      setOpen(true)
    },
    onBlur: (event) => {
      children.props.onBlur?.(event)
      setOpen(false)
    },
    onPointerDown: (event) => {
      children.props.onPointerDown?.(event)
      if (event.pointerType !== 'touch') return
      setOpen(true)
      setTap((count) => count + 1)
    },
  })

  return (
    <span className={`relative ${className || 'inline-flex'}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {trigger}
      <span
        id={id}
        role="tooltip"
        aria-hidden={describes ? undefined : true}
        hidden={!open}
        className={`pointer-events-none absolute z-50 w-max max-w-60 rounded-dashboard-control bg-dashboard-foreground px-2.5 py-1.5 text-dashboard-secondary font-medium text-white shadow-dashboard-overlay ${sideClasses[side]}`}
      >
        {content}
      </span>
    </span>
  )
}
