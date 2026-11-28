'use client'

import { useSyncExternalStore } from 'react'

function subscribe(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

const getSnapshot = () => navigator.onLine !== false
// The server cannot know; render online and let the browser correct it.
const getServerSnapshot = () => true

/** Whether the browser has a connection (SH-13). True while rendering on the server. */
export function useOnline() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
