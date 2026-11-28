'use client'

import { forwardRef } from 'react'
import { useOnline } from '@/lib/offline/use-online'
import { Button, type ButtonProps } from './button'

/**
 * The offline reason for an action that needs the server (SH-13), or
 * undefined while online. Pass the action's own sentence, for example
 * "You're offline. You can complete this summary when you're back online."
 */
export function useOfflineReason(reason: string) {
  return useOnline() ? undefined : reason
}

/**
 * A Button that is disabled while offline, with the reason shown as text
 * under it (Complete, Send, Join classroom, Start lesson, Schedule, Cancel
 * lesson, Delete, Draft with Kavi). Nothing is queued for later.
 */
export const OnlineOnlyButton = forwardRef<HTMLButtonElement, ButtonProps & { offlineReason: string }>(function OnlineOnlyButton(
  { offlineReason, disabledReason, ...props },
  ref,
) {
  const offline = useOfflineReason(offlineReason)
  return <Button ref={ref} {...props} disabledReason={offline ?? disabledReason} />
})
