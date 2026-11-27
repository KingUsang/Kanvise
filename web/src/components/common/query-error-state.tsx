'use client'

import { safeApiErrorMessage } from '@/lib/safe-api-error'

type QueryLike = {
  isError: boolean
  isFetching?: boolean
  data: unknown
  error: unknown
  refetch: () => unknown
}

/** Full-area failure state for an initial load, with a retry action. */
export function QueryErrorState({
  error,
  onRetry,
  fallback = 'We could not load this page.',
  retrying = false,
  className = 'rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800',
}: {
  error: unknown
  onRetry: () => void
  fallback?: string
  retrying?: boolean
  className?: string
}) {
  return (
    <div role="alert" className={className}>
      <p>{safeApiErrorMessage(error, fallback)}</p>
      <button type="button" onClick={onRetry} disabled={retrying} className="mt-3 font-semibold underline disabled:opacity-60">
        {retrying ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  )
}

/** Non-blocking notice shown while cached data stays on screen after a failed refresh. */
export function RefreshWarning({
  onRetry,
  retrying = false,
  message = 'We could not refresh this page. Showing the last loaded data.',
}: {
  onRetry: () => void
  retrying?: boolean
  message?: string
}) {
  return (
    <div role="status" aria-live="polite" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <span>{message}</span>
      <button type="button" onClick={onRetry} disabled={retrying} className="font-semibold underline disabled:opacity-60">
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  )
}

/**
 * Decides what to render for a query: full error only when no data was ever loaded,
 * otherwise cached data plus a refresh warning.
 */
export function QueryFailure({ query, fallback }: { query: QueryLike; fallback?: string }) {
  if (!query.isError) return null
  const retry = () => void query.refetch()
  return query.data === undefined
    ? <QueryErrorState error={query.error} onRetry={retry} fallback={fallback} retrying={query.isFetching} />
    : <RefreshWarning onRetry={retry} retrying={query.isFetching} />
}
