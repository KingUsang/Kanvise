'use client'

import { useState, type ReactNode } from 'react'
import { ListFilter, X } from 'lucide-react'
import { Button } from '@/components/dashboard/action-controls'
import { Sheet } from './sheet'

export type ActiveFilter = { key: string; label: string }

/**
 * Phone filters (R-04): one Filter button that opens a bottom sheet with the
 * same options and "Show results". `onApply` runs when the person presses
 * Show results; the sheet closes after it.
 */
export function FilterSheet({ children, onApply, activeCount = 0, title = 'Filter' }: {
  children: ReactNode
  onApply: () => void
  activeCount?: number
  title?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <ListFilter aria-hidden="true" className="size-4" />
        {title}
        {activeCount > 0 ? <span className="text-dashboard-muted">({activeCount})</span> : null}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={<Button variant="primary" onClick={() => { onApply(); setOpen(false) }}>Show results</Button>}
      >
        {children}
      </Sheet>
    </>
  )
}

/** Active filters as removable chips under the search box (R-04). */
export function ActiveFilterChips({ filters, onRemove, onClearAll }: {
  filters: ActiveFilter[]
  onRemove: (key: string) => void
  onClearAll?: () => void
}) {
  if (filters.length === 0) return null
  return (
    <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <li key={filter.key}>
          <button
            type="button"
            onClick={() => onRemove(filter.key)}
            aria-label={`Remove filter: ${filter.label}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashboard-outline bg-dashboard-surface px-3 text-dashboard-secondary font-semibold text-dashboard-foreground hover:bg-dashboard-surface-hover"
          >
            {filter.label}
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </li>
      ))}
      {onClearAll && filters.length > 1 ? (
        <li>
          <button type="button" onClick={onClearAll} className="min-h-11 px-2 text-dashboard-secondary font-semibold text-dashboard-primary underline-offset-2 hover:underline">Clear all</button>
        </li>
      ) : null}
    </ul>
  )
}
