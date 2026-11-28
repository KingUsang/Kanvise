'use client'

import { useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'

export type OfflineBannerMode = 'offline' | 'reconnecting' | null

export const OFFLINE_BANNER_COPY = "You're offline. Changes are saved on this device and will upload when you're back."

export function uploadingCopy(count: number) {
  return `Back online. Uploading ${count} ${count === 1 ? 'change' : 'changes'}…`
}

/**
 * Which banner line to show (SH-13): the offline line while there is no
 * connection; after it returns, the uploading line until nothing is left to
 * upload; nothing otherwise. Ordinary saving while online shows no banner.
 */
export function useOfflineBanner(online: boolean, uploading: number): { mode: OfflineBannerMode; count: number } {
  const [wasOffline, setWasOffline] = useState(!online)
  if (!online && !wasOffline) setWasOffline(true)
  if (online && wasOffline && uploading === 0) setWasOffline(false)
  if (!online) return { mode: 'offline', count: uploading }
  if (wasOffline && uploading > 0) return { mode: 'reconnecting', count: uploading }
  return { mode: null, count: 0 }
}

/**
 * The slim banner under the page header (under the top bar on phones), never
 * at the bottom of the screen (R-10). The status region is always mounted so
 * each change is announced politely.
 */
export function OfflineBanner({ mode, count, className = '' }: { mode: OfflineBannerMode; count: number; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={className}>
      {mode === 'offline' ? (
        <p
          key="offline"
          className="animate-dashboard-menu-in flex items-start gap-2 border-b border-dashboard-warning/30 bg-dashboard-warning-surface px-dashboard-gutter py-2 text-dashboard-secondary font-medium text-dashboard-foreground"
        >
          <CloudOff aria-hidden="true" className="mt-px size-4 shrink-0 text-dashboard-warning" />
          {OFFLINE_BANNER_COPY}
        </p>
      ) : mode === 'reconnecting' ? (
        <p
          key="reconnecting"
          className="animate-dashboard-menu-in flex items-start gap-2 border-b border-dashboard-info/20 bg-dashboard-info-surface px-dashboard-gutter py-2 text-dashboard-secondary font-medium text-dashboard-foreground"
        >
          <RefreshCw aria-hidden="true" className="mt-px size-4 shrink-0 animate-spin text-dashboard-info [animation-duration:1.6s]" />
          {uploadingCopy(count)}
        </p>
      ) : null}
    </div>
  )
}
