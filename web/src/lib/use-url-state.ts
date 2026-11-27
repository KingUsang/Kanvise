/** Pure helper: return the query string with `updates` applied. Empty values
 * and values equal to their default are removed so URLs stay short. */
export function withSearchParams(current: string, updates: Record<string, string | number | null | undefined>, defaults: Record<string, string> = {}) {
  const params = new URLSearchParams(current)
  for (const [key, value] of Object.entries(updates)) {
    const text = value === null || value === undefined ? '' : String(value)
    if (text === '' || text === (defaults[key] ?? '')) params.delete(key)
    else params.set(key, text)
  }
  return params.toString()
}

export function parsePageParam(value: string | null) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 ? page : 1
}

/** Read one param from the current URL on the client (null during SSR). */
export function readUrlParam(key: string) {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(key)
}

/** Write shareable list state (search, filters, page) to the URL. Replaces the
 * history entry so typing does not flood back/forward, and avoids a Next
 * navigation so list components keep their state. */
export function writeUrlParams(updates: Record<string, string | number | null | undefined>, defaults: Record<string, string> = {}) {
  if (typeof window === 'undefined') return
  const next = withSearchParams(window.location.search, updates, defaults)
  const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`
  window.history.replaceState(window.history.state, '', url)
}
