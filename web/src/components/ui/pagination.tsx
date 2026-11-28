import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { actionControlClassName } from '@/components/dashboard/action-controls'
import { withSearchParams } from '@/lib/use-url-state'

/** Every list shows 25 items per page (R-04). */
export const PAGE_SIZE = 25

export function pageCountFor(total: number, pageSize = PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Link target for `page`, keeping every other filter in the query string. Page 1 drops the param. */
export function pageHref(pathname: string, search: string, page: number, param = 'page') {
  const query = withSearchParams(search, { [param]: page }, { [param]: '1' })
  return query ? `${pathname}?${query}` : pathname
}

/**
 * Previous, "Page 2 of 5", Next under a list (R-04). Pages are real links,
 * so the page number lives in the URL and Back, refresh and shared links
 * return to the same place. The ends render disabled buttons.
 */
export function Pagination({ page, pageCount, pathname, search, param = 'page', label = 'Pagination' }: {
  page: number
  pageCount: number
  pathname: string
  /** Current query string, with or without the leading "?". */
  search: string
  param?: string
  label?: string
}) {
  if (pageCount <= 1) return null
  const current = Math.min(Math.max(1, page), pageCount)
  const query = search.startsWith('?') ? search.slice(1) : search
  const control = actionControlClassName({ variant: 'outline' })
  return (
    <nav aria-label={label} className="mt-6 flex items-center justify-between gap-3">
      {current > 1
        ? <Link href={pageHref(pathname, query, current - 1, param)} rel="prev" className={control}><ChevronLeft aria-hidden="true" className="size-4" />Previous</Link>
        : <button type="button" disabled className={control}><ChevronLeft aria-hidden="true" className="size-4" />Previous</button>}
      <p aria-live="polite" className="text-dashboard-small font-medium text-dashboard-muted">Page {current} of {pageCount}</p>
      {current < pageCount
        ? <Link href={pageHref(pathname, query, current + 1, param)} rel="next" className={control}>Next<ChevronRight aria-hidden="true" className="size-4" /></Link>
        : <button type="button" disabled className={control}>Next<ChevronRight aria-hidden="true" className="size-4" /></button>}
    </nav>
  )
}
