import { useSyncExternalStore } from 'react'
import {
  ACCOUNT_CONTEXT_HEADER,
  ACCOUNT_COOKIE_MAX_AGE_SECONDS,
  ACCOUNT_COOKIE_NAME,
  accountHeadersFor,
  isValidAccountId,
} from './account-cookie'

export { ACCOUNT_CONTEXT_HEADER, isValidAccountId }

// Earlier releases kept the selection only in sessionStorage. It is still read
// once as a fallback so an open tab keeps its account after this release, and
// it is removed whenever the selection is written or cleared.
const LEGACY_SESSION_KEY = 'kanvise:active-account:v1'
export const ACTIVE_ACCOUNT_CHANGED_EVENT = 'kanvise:active-account-changed'

function browserDocument() {
  return typeof document === 'undefined' ? null : document
}

function legacySessionValue() {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(LEGACY_SESSION_KEY)
  } catch {
    return null
  }
}

function removeLegacySessionValue() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(LEGACY_SESSION_KEY)
  } catch {
    // Storage can be unavailable (privacy mode); the cookie is the source of truth.
  }
}

export function readAccountCookie(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name !== ACCOUNT_COOKIE_NAME) continue
    const value = decodeURIComponent(rest.join('='))
    return isValidAccountId(value) ? value : null
  }
  return null
}

function writeAccountCookie(value: string, maxAge: number) {
  const doc = browserDocument()
  if (!doc) return
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  doc.cookie = `${ACCOUNT_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

/**
 * The selected account lives in a first-party cookie so Server Components and
 * route handlers can send it too (see account-cookie.ts for why it is not
 * HttpOnly). It is a preference only; the API verifies membership every time.
 */
export function getActiveAccountId() {
  const doc = browserDocument()
  if (!doc) return null
  const fromCookie = readAccountCookie(doc.cookie)
  if (fromCookie) return fromCookie
  const legacy = legacySessionValue()
  return isValidAccountId(legacy) ? legacy : null
}

/** Headers naming the selected account, for raw fetch callers that cannot use authenticatedFetch. */
export function accountContextHeaders(): Record<string, string> {
  return accountHeadersFor(getActiveAccountId())
}

export function setActiveAccountId(accountId: string) {
  if (!isValidAccountId(accountId)) throw new Error('Invalid account identifier')
  if (!browserDocument()) return
  writeAccountCookie(accountId, ACCOUNT_COOKIE_MAX_AGE_SECONDS)
  removeLegacySessionValue()
  window.dispatchEvent(new CustomEvent(ACTIVE_ACCOUNT_CHANGED_EVENT, { detail: accountId }))
}

export function clearActiveAccountId() {
  if (!browserDocument()) return
  writeAccountCookie('', 0)
  removeLegacySessionValue()
  window.dispatchEvent(new CustomEvent(ACTIVE_ACCOUNT_CHANGED_EVENT, { detail: null }))
}

export function subscribeToActiveAccount(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined
  const handleChange = () => listener()
  window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleChange)
  return () => window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleChange)
}

const getServerActiveAccountId = () => null

export function useActiveAccountId() {
  return useSyncExternalStore(subscribeToActiveAccount, getActiveAccountId, getServerActiveAccountId)
}
