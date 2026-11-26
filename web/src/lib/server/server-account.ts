import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  ACCOUNT_COOKIE_NAME,
  accountHeadersFor,
  accountPickerHref,
  isValidAccountId,
} from '@/lib/account-cookie'
import { isAccountSelectionRequired } from '@/lib/server-api-error'

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
 * Runs a server-side API load and sends the user to the account picker when
 * the API needs an account selection, instead of rendering an error screen.
 */
export async function withAccountPicker<T>(load: () => Promise<T>, returnPath: string): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (isAccountSelectionRequired(error)) redirect(accountPickerHref(returnPath))
    throw error
  }
}
