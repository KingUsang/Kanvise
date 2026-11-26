import { useSyncExternalStore } from 'react'

const ACTIVE_ACCOUNT_KEY = 'kanvise:active-account:v1'
export const ACCOUNT_CONTEXT_HEADER = 'X-Kanvise-Account-Id'
export const ACTIVE_ACCOUNT_CHANGED_EVENT = 'kanvise:active-account-changed'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidAccountId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function browserSessionStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function getActiveAccountId() {
  const storage = browserSessionStorage()
  if (!storage) return null
  const value = storage.getItem(ACTIVE_ACCOUNT_KEY)
  return isValidAccountId(value) ? value : null
}

/** Headers naming the selected account, for raw fetch callers that cannot use authenticatedFetch. */
export function accountContextHeaders(): Record<string, string> {
  const accountId = getActiveAccountId()
  return accountId ? { [ACCOUNT_CONTEXT_HEADER]: accountId } : {}
}

export function setActiveAccountId(accountId: string) {
  if (!isValidAccountId(accountId)) throw new Error('Invalid account identifier')
  const storage = browserSessionStorage()
  if (!storage) return
  storage.setItem(ACTIVE_ACCOUNT_KEY, accountId)
  window.dispatchEvent(new CustomEvent(ACTIVE_ACCOUNT_CHANGED_EVENT, { detail: accountId }))
}

export function clearActiveAccountId() {
  const storage = browserSessionStorage()
  if (!storage) return
  storage.removeItem(ACTIVE_ACCOUNT_KEY)
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
