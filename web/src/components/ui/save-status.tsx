'use client'

import { useState } from 'react'
import { AlertCircle, Check, CloudOff, Loader2 } from 'lucide-react'
import type { FieldState } from '@/lib/offline/save-queue'
import { LiveRegion } from './live-region'

export const SAVE_STATUS_COPY = {
  saving: 'Saving…',
  saved: 'Saved',
  device: "Saved on this device. It will upload when you're back online.",
  failed: "Couldn't save.",
  retry: 'Retry',
  conflict: 'This changed while you were offline.',
} as const

/** "4:12 PM" */
export function formatSavedTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function announcementFor(key: FieldState | 'conflict') {
  if (key === 'saved-on-device') return SAVE_STATUS_COPY.device
  if (key === 'couldnt-save') return SAVE_STATUS_COPY.failed
  if (key === 'conflict') return SAVE_STATUS_COPY.conflict
  return ''
}

/**
 * The one honest saving state next to a field that saves by itself (SH-13).
 * Screen readers hear it only when it changes to "Saved on this device" or
 * "Couldn't save" (SH-12), and once when a newer version is found; never on
 * every keystroke. While `conflict` is set the ConflictBanner says it instead.
 */
export function SaveStatus({ state, savedAt, onRetry, conflict = false, className = '' }: {
  state: FieldState
  savedAt?: Date | null
  onRetry?: () => void
  conflict?: boolean
  className?: string
}) {
  const key: FieldState | 'conflict' = conflict ? 'conflict' : state
  const [lastKey, setLastKey] = useState(key)
  const [announcement, setAnnouncement] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    setAnnouncement(announcementFor(key))
  }
  const [showTime, setShowTime] = useState(false)

  let content = null
  if (!conflict && state === 'saving') {
    content = (
      <span className="inline-flex min-h-11 items-center gap-1.5">
        <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
        {SAVE_STATUS_COPY.saving}
      </span>
    )
  } else if (!conflict && state === 'saved') {
    const time = savedAt ? formatSavedTime(savedAt) : null
    content = (
      <button
        type="button"
        aria-label={time ? `Saved at ${time}` : SAVE_STATUS_COPY.saved}
        onFocus={() => setShowTime(true)}
        onBlur={() => setShowTime(false)}
        onClick={() => setShowTime((value) => !value)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-dashboard-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-focus"
      >
        <Check aria-hidden="true" className="size-4 shrink-0 text-dashboard-success" />
        {showTime && time ? `Saved at ${time}` : SAVE_STATUS_COPY.saved}
      </button>
    )
  } else if (!conflict && state === 'saved-on-device') {
    content = (
      <span className="inline-flex min-h-11 items-center gap-1.5">
        <CloudOff aria-hidden="true" className="size-4 shrink-0" />
        {SAVE_STATUS_COPY.device}
      </span>
    )
  } else if (!conflict && state === 'couldnt-save') {
    content = (
      <span className="inline-flex min-h-11 flex-wrap items-center gap-x-2 text-dashboard-danger">
        <span className="inline-flex items-center gap-1.5">
          <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
          {SAVE_STATUS_COPY.failed}
        </span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center rounded-dashboard-control px-1 font-semibold text-dashboard-primary underline underline-offset-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-focus"
          >
            {SAVE_STATUS_COPY.retry}
          </button>
        ) : null}
      </span>
    )
  }

  return (
    <div data-save-state={key} className={`inline-flex items-center text-dashboard-secondary font-medium text-dashboard-muted ${className}`.trim()}>
      {content}
      <LiveRegion message={announcement} />
    </div>
  )
}
