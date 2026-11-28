import Link from 'next/link'
import type { ReactNode } from 'react'

export type DataColumn<T> = {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Right-align numbers and status. */
  align?: 'start' | 'end'
}

export type DataCard<T> = {
  /** Line 1: the main thing, bold. */
  title: (row: T) => ReactNode
  /** Line 2: the two most useful details. */
  details: (row: T) => [ReactNode, ReactNode?]
  /** Right side: the status chip. */
  status?: (row: T) => ReactNode
}

/**
 * One list, two layouts (R-04): a table from 768px, cards on phones. The
 * first column and the whole phone card are real links to the row's page;
 * row actions stay on the detail page.
 */
export function ResponsiveTable<T>({ caption, rows, getKey, getHref, columns, card, empty }: {
  /** Names the table for assistive tech. */
  caption: string
  rows: T[]
  getKey: (row: T) => string
  getHref: (row: T) => string
  columns: DataColumn<T>[]
  card: DataCard<T>
  /** Shown instead of the list when there are no rows. */
  empty?: ReactNode
}) {
  if (rows.length === 0 && empty) return <>{empty}</>
  return (
    <div className="min-w-0">
      <div className="hidden overflow-hidden rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface md:block">
        <table className="w-full border-collapse text-left text-dashboard-small">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-dashboard-outline bg-dashboard-surface-subtle text-dashboard-secondary font-semibold text-dashboard-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={`px-4 py-3 ${column.align === 'end' ? 'text-right' : ''}`}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getKey(row)} className="border-b border-dashboard-outline last:border-b-0 hover:bg-dashboard-surface-subtle">
                {columns.map((column, index) => (
                  <td key={column.key} className={`px-4 py-3 text-dashboard-foreground ${column.align === 'end' ? 'text-right' : ''}`}>
                    {index === 0
                      ? <Link href={getHref(row)} className="font-semibold text-dashboard-foreground underline-offset-2 hover:underline">{column.cell(row)}</Link>
                      : column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label={caption} className="space-y-2 md:hidden">
        {rows.map((row) => {
          const [first, second] = card.details(row)
          return (
            <li key={getKey(row)}>
              <Link href={getHref(row)} className="dashboard-card-lift flex min-h-11 items-center gap-3 rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-dashboard-body font-semibold text-dashboard-foreground">{card.title(row)}</span>
                  <span className="mt-0.5 block truncate text-dashboard-secondary text-dashboard-muted">
                    {first}
                    {second ? <> · {second}</> : null}
                  </span>
                </span>
                {card.status ? <span className="shrink-0">{card.status(row)}</span> : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
