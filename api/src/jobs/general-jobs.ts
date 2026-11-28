import { runDurableJobs } from './durable-jobs'
import { createNotificationJobHandlers } from './runners'
import { storageCleanupHandlers } from './storage-cleanup'
import { createHeldMessageJobHandlers } from '../notifications/held-messages'

export function runGeneralDurableJobs() {
  return runDurableJobs({
    handlers: { ...createNotificationJobHandlers(), ...storageCleanupHandlers, ...createHeldMessageJobHandlers() },
    limit: 10,
  })
}
