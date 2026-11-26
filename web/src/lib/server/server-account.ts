import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  ACCOUNT_COOKIE_NAME,
  accountHeadersFor,
  accountPickerHref,
  isValidAccountId,
} from '@/lib/account-cookie'
import { isAccountAccessDenied, isAccountSelectionRequired } from '@/lib/server-api-error'

export { ServerApiError, isAccountSelectionRequired } from '@/lib/server-api-error'

/** The selected account from the request cookie, or null when absent or not a UUID. */
export async function serverActiveAccountId() {
  const value = (await cookies()).get(ACCOUNT_COOKIE_NAME)?.value
  return isValidAccountId(value) ? value : null
}

/**
 * X-Kanvise-Account-Id for server-side calls to account-scoped API routers.
 * Empty when no valid selection exists; the API then resolves a single
 * membership itself or answers ACCOUNT_SELECTION_REQUIRED.
 */
export async function serverAccountContextHeaders(): Promise<Record<string, string>> {
  return accountHeadersFor(await serverActiveAccountId())
}

/**
 * Runs a server-side API load and sends the user to the account picker,
 * instead of rendering an error screen, when the API needs an account
 * selection or rejects the account named by the cookie (a stale selection, or
 * one left by a previous user on this browser). Server Components cannot
 * write cookies, so the picker clears the stale value once memberships load.
 */
export async function withAccountPicker<T>(load: () => Promise<T>, returnPath: string): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (isAccountSelectionRequired(error)) redirect(accountPickerHref(returnPath))
    if (isAccountAccessDenied(error) && await serverActiveAccountId()) redirect(accountPickerHref(returnPath))
    throw error
  }
}
