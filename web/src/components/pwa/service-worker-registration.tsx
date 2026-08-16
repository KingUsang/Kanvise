'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
  }, [])
  return null
}
