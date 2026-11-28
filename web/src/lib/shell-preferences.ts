import { useSyncExternalStore } from 'react'

/*
 * Small per-device preferences for the dashboard shell (01-app-shell SH-02,
 * SH-04a, SH-07). Storage can be unavailable (privacy mode); every read and
 * write falls back quietly.
 */

const SIDEBAR_COLLAPSED_KEY = 'kanvise:sidebar-collapsed:v1'
const WHATS_NEW_READ_PREFIX = 'kanvise:whats-new-read:v1:'
const ACCOUNT_SWITCHED_KEY = 'kanvise:account-switched:v1'
const CHANGED_EVENT = 'kanvise:shell-preferences-changed'

function read(storage: 'local' | 'session', key: string) {
  if (typeof window === 'undefined') return null
  try {
    return (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key)
  } catch {
    return null
  }
}

function write(storage: 'local' | 'session', key: string, value: string | null) {
  if (typeof window === 'undefined') return
  try {
    const target = storage === 'local' ? window.localStorage : window.sessionStorage
    if (value === null) target.removeItem(key)
    else target.setItem(key, value)
  } catch {
    // Keep working without storage; the preference just isn't remembered.
  }
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

function subscribe(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(CHANGED_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(CHANGED_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

export function isSidebarCollapsed() {
  return read('local', SIDEBAR_COLLAPSED_KEY) === '1'
}

export function setSidebarCollapsed(collapsed: boolean) {
  write('local', SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : null)
}

/** Desktop rail preference, remembered per device. False while rendering on the server. */
export function useSidebarCollapsed() {
  return useSyncExternalStore(subscribe, isSidebarCollapsed, () => false)
}

export function whatsNewReadId(profileId: string) {
  return read('local', `${WHATS_NEW_READ_PREFIX}${profileId}`)
}

/** Marks What's new as read up to `entryId` for this person on this device. */
export function markWhatsNewRead(profileId: string, entryId: string) {
  write('local', `${WHATS_NEW_READ_PREFIX}${profileId}`, entryId)
}

/** True while the newest entry is unread. False on the server, so no dot flashes. */
export function useWhatsNewUnread(profileId: string, newestEntryId: string | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => Boolean(newestEntryId && profileId && whatsNewReadId(profileId) !== newestEntryId),
    () => false,
  )
}

/** Remembers the new account's name across the reload that switching does. */
export function rememberAccountSwitch(name: string) {
  write('session', ACCOUNT_SWITCHED_KEY, name)
}

/** Returns the name once, then forgets it. */
export function takeAccountSwitch() {
  const name = read('session', ACCOUNT_SWITCHED_KEY)
  if (name !== null) write('session', ACCOUNT_SWITCHED_KEY, null)
  return name
}
