/**
 * Shared constants for the selected tutoring account. Used by browser code
 * (account-preference.ts) and server code (lib/server/server-account.ts), so it
 * must stay free of React and next/headers imports.
 */
export const ACCOUNT_CONTEXT_HEADER = 'X-Kanvise-Account-Id'

/**
 * First-party cookie holding the selected account id. It is deliberately not
 * HttpOnly: the Hono API runs on a different site, so browser code must read
 * the value to build the X-Kanvise-Account-Id header itself. The value is a
 * non-secret account id hint; the API verifies an active membership for it on
 * every request, so reading or forging it through XSS grants no access.
 */
export const ACCOUNT_COOKIE_NAME = 'kanvise_account'
export const ACCOUNT_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60

/** API code returned when a person with several active memberships sends no account. */
export const ACCOUNT_SELECTION_REQUIRED = 'ACCOUNT_SELECTION_REQUIRED'
export const ACCOUNT_PICKER_PATH = '/account/select'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidAccountId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function accountHeadersFor(accountId: string | null | undefined): Record<string, string> {
  return isValidAccountId(accountId) ? { [ACCOUNT_CONTEXT_HEADER]: accountId } : {}
}

/** Picker URL that returns to `returnPath` after a selection. The picker re-checks it with safeRedirectPath. */
export function accountPickerHref(returnPath?: string | null) {
  if (!returnPath || returnPath.startsWith(ACCOUNT_PICKER_PATH)) return ACCOUNT_PICKER_PATH
  return `${ACCOUNT_PICKER_PATH}?redirect=${encodeURIComponent(returnPath)}`
}
