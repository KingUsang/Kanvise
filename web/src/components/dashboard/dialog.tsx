'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './action-controls'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function Dialog({
  open,
  onClose,
  title,
  description,
  eyebrow,
  children,
  busy = false,
  titleId = 'dialog-title',
  descriptionId = 'dialog-description',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description: ReactNode
  eyebrow?: ReactNode
  children: ReactNode
  busy?: boolean
  titleId?: string
  descriptionId?: string
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const busyRef = useRef(busy)

  useEffect(() => {
    onCloseRef.current = onClose
    busyRef.current = busy
  }, [busy, onClose])

  useEffect(() => {
    if (!open) return

    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusInitial = () => {
      const initial = dialogRef.current?.querySelector<HTMLElement>('[data-dialog-initial-focus]')
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(focusableSelector)
      ;(initial || firstFocusable || dialogRef.current)?.focus()
    }
    const frame = window.requestAnimationFrame(focusInitial)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (busyRef.current) return
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusables = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) || [])
      if (!focusables.length) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (restoreRef.current?.isConnected) restoreRef.current.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end justify-center bg-dashboard-foreground/40 p-0 outline-none sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div className="motion-safe:transition-[transform,opacity] motion-safe:duration-150 motion-reduce:transition-none max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-2xl bg-dashboard-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-dashboard-card sm:max-w-lg sm:rounded-dashboard-panel sm:p-6 sm:pb-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? <p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">{eyebrow}</p> : null}
            <h2 id={titleId} className="mt-1 text-xl font-bold text-dashboard-foreground">{title}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-dashboard-muted">{description}</p>
          </div>
          <IconButton
            type="button"
            variant="quiet"
            label="Close dialog"
            onClick={onClose}
            disabled={busy}
          >
            <X aria-hidden="true" size={20} />
          </IconButton>
        </header>
        {children}
      </div>
    </div>
  )
}
