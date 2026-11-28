'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Dialog, useDialogIds } from './dialog'
import { IconButton } from '@/components/dashboard/action-controls'

const sideClasses = {
  bottom: 'items-end justify-center',
  right: 'items-stretch justify-end',
  left: 'items-stretch justify-start',
} as const

const panelClasses = {
  bottom: 'animate-dashboard-sheet-up max-h-[90dvh] w-full rounded-t-dashboard-dialog md:max-w-lg md:mb-4 md:rounded-dashboard-dialog',
  right: 'animate-dashboard-sheet-right h-dvh w-full max-w-sm',
  left: 'animate-dashboard-sheet-left h-dvh w-full max-w-sm',
} as const

/**
 * Sheet from the bottom (filters, phone menus) or a side (More, drawers).
 * Same focus rules as every dialog (SH-12): focus moves in, is trapped,
 * Escape closes, focus returns to the opener.
 */
export function Sheet({ open, onClose, title, description, side = 'bottom', footer, children, hideTitle = false }: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  side?: keyof typeof sideClasses
  /** Fixed at the bottom of the sheet, for example "Show results". */
  footer?: ReactNode
  children: ReactNode
  /** Keep the title for assistive tech only (the content already has a heading). */
  hideTitle?: boolean
}) {
  const { titleId, descriptionId } = useDialogIds()
  if (!open) return null
  return (
    <Dialog
      labelledBy={titleId}
      describedBy={description ? descriptionId : undefined}
      onClose={onClose}
      closeOnBack
      layout={`sheet-${side}`}
      className={`animate-dashboard-scrim-in fixed inset-0 z-[99999] flex bg-dashboard-scrim backdrop-blur-sm ${sideClasses[side]}`}
      panelClassName={`flex flex-col overflow-hidden bg-dashboard-surface shadow-dashboard-overlay outline-none ${panelClasses[side]}`}
    >
      <header className={`flex items-center gap-2 border-b border-dashboard-outline px-4 py-2 ${hideTitle ? 'justify-end' : ''}`}>
        <h2 id={titleId} className={hideTitle ? 'sr-only' : 'min-w-0 flex-1 text-dashboard-section-title font-semibold text-dashboard-foreground'}>{title}</h2>
        <IconButton variant="quiet" label="Close" onClick={onClose} className="-mr-2 shrink-0">
          <X aria-hidden="true" className="size-5" />
        </IconButton>
      </header>
      {description ? <p id={descriptionId} className="px-4 pt-3 text-dashboard-small text-dashboard-muted">{description}</p> : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer ? <footer className="border-t border-dashboard-outline px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>*]:w-full">{footer}</footer> : null}
    </Dialog>
  )
}
