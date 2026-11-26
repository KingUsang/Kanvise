import { runDurableJobs } from './durable-jobs'
import { createNotificationJobHandlers } from './runners'
import { storageCleanupHandlers } from './storage-cleanup'

export function runGeneralDurableJobs() {
  return runDurableJobs({ handlers: { ...createNotificationJobHandlers(), ...storageCleanupHandlers }, limit: 10 })
}
