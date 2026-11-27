/**
 * List endpoints cap each page at 100 rows and report `pagination.has_more`.
 * This follows the pages so a list is never silently truncated.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<Response>,
  fallbackError: string,
  errorMessage?: (response: Response, body: any) => string,
): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; page <= 50; page += 1) {
    const response = await fetchPage(page)
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(errorMessage ? errorMessage(response, body) : body?.error || fallbackError)
    rows.push(...((body?.data || []) as T[]))
    if (!body?.pagination?.has_more) break
  }
  return rows
}
