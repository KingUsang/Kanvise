import { getSaveQueue } from '@/lib/offline/save-queue'

/**
 * How many changes are saved on this device but not uploaded yet, for the
 * signed-in person in any of their accounts (01-app-shell SH-06, SH-13). The
 * account menu asks before signing out when this is above zero.
 */
export async function getPendingUploadCount(): Promise<number> {
  return getSaveQueue().pendingCount()
}

/** Only after "Sign out anyway" (SH-06): the waiting changes are lost from this device. */
export async function discardPendingUploads(): Promise<void> {
  const queue = getSaveQueue()
  const personId = queue.getScope()?.personId
  if (personId) await queue.clearForPerson(personId)
}
