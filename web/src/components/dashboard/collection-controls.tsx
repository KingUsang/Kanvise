import type { ReactNode } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'

export type CollectionFilterOption<Value extends string = string> = {
  value: Value
  label: string
}

type CollectionToolbarProps<Value extends string> = {
  ariaLabel: string
  searchLabel: string
  searchPlaceholder: string
  searchValue: string
  onSearchChange: (value: string) => void
  filterLabel: string
  filterValue: Value
  filterOptions: readonly CollectionFilterOption<Value>[]
  onFilterChange: (value: Value) => void
  resultCount: number
  totalCount: number
  itemLabel: string
  itemPluralLabel?: string
  action?: ReactNode
}

function resultLabel(resultCount: number, totalCount: number, itemLabel: string, itemPluralLabel: string) {
  const totalLabel = totalCount === 1 ? itemLabel : itemPluralLabel
  if (resultCount === totalCount) return `${totalCount} ${totalLabel}`
  return `${resultCount} of ${totalCount} ${itemPluralLabel}`
}

export function CollectionToolbar<Value extends string>({
  ariaLabel,
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  filterLabel,
  filterValue,
  filterOptions,
  onFilterChange,
  resultCount,
  totalCount,
  itemLabel,
  itemPluralLabel = itemLabel === 'class' ? 'classes' : `${itemLabel}s`,
  action,
}: CollectionToolbarProps<Value>) {
  return (
    <section
      role="toolbar"
      aria-label={ariaLabel}
      className="flex flex-col gap-3 rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface p-3 shadow-dashboard-card sm:flex-row sm:items-end sm:gap-4 sm:p-4"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">{searchLabel}</span>
          <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dashboard-muted" />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="min-h-11 w-full rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-3 pl-10 text-sm text-dashboard-foreground outline-none transition focus-visible:outline-2 focus-visible:outline-dashboard-primary focus-visible:outline-offset-2"
          />
        </label>

        <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-3 text-sm font-semibold text-dashboard-foreground sm:w-44">
          <SlidersHorizontal aria-hidden="true" size={17} className="shrink-0 text-dashboard-muted" />
          <span className="sr-only">{filterLabel}</span>
          <select
            value={filterValue}
            onChange={(event) => onFilterChange(event.target.value as Value)}
            aria-label={filterLabel}
            className="min-h-10 min-w-0 flex-1 bg-transparent outline-none focus-visible:outline-2 focus-visible:outline-dashboard-primary focus-visible:outline-offset-2"
          >
            {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        <p role="status" aria-live="polite" className="text-sm text-dashboard-muted">
          {resultLabel(resultCount, totalCount, itemLabel, itemPluralLabel)}
        </p>
        {action ? <div className="w-full sm:w-auto">{action}</div> : null}
      </div>
    </section>
  )
}
