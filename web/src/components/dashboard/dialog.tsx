'use client'

import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Dialog as BaseDialog } from '@/components/ui/dialog'
import { IconButton } from './action-controls'

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
  if (!open) return null

  return (
    <BaseDialog
      labelledBy={titleId}
      describedBy={descriptionId}
      onClose={busy ? undefined : onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-dashboard-foreground/40 p-0 outline-none sm:items-center sm:p-4"
      panelClassName="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-2xl bg-dashboard-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-dashboard-card outline-none motion-safe:transition-[transform,opacity] motion-safe:duration-150 motion-reduce:transition-none sm:max-w-lg sm:rounded-dashboard-panel sm:p-6 sm:pb-6"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-[.14em] text-dashboard-accent">{eyebrow}</p> : null}
          <h2 id={titleId} className="mt-1 text-xl font-bold text-dashboard-foreground">{title}</h2>
          <p id={descriptionId} className="mt-1 text-sm leading-6 text-dashboard-muted">{description}</p>
        </div>
        <IconButton type="button" variant="quiet" label="Close dialog" onClick={onClose} disabled={busy}>
          <X aria-hidden="true" size={20} />
        </IconButton>
      </header>
      {children}
    </BaseDialog>
  )
}
