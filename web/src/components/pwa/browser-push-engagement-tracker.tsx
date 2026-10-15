'use client'

import { useEffect } from 'react'
import { recordBrowserPushEngagement } from '@/lib/pwa/browser-push-eligibility'

export function BrowserPushEngagementTracker() {
  useEffect(() => {
    const record = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      if (event.target.closest('a[href], button')) recordBrowserPushEngagement()
    }
    document.addEventListener('click', record)
    return () => document.removeEventListener('click', record)
  }, [])

  return null
}
