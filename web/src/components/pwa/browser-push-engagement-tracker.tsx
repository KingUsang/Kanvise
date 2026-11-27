'use client'

import { useEffect } from 'react'
import { recordInstallEngagement } from '@/lib/pwa/install-eligibility'
import { recordBrowserPushEngagement } from '@/lib/pwa/browser-push-eligibility'

export function BrowserPushEngagementTracker() {
  useEffect(() => {
    const record = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      if (!event.target.closest('a[href], button')) return
      recordBrowserPushEngagement()
      recordInstallEngagement()
    }
    document.addEventListener('click', record)
    return () => document.removeEventListener('click', record)
  }, [])

  return null
}
