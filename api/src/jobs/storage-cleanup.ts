import { deletePrivateObject } from '../storage/r2'
import { durableJobStore, type DurableJobHandlers, type DurableJobStore } from './durable-jobs'

export const DELETE_OBJECT_JOB = 'delete_private_object'

export const storageCleanupHandlers: DurableJobHandlers = {
  // Deleting a missing object succeeds in R2, so the job is safe to re-run.
  [DELETE_OBJECT_JOB]: async (job) => deletePrivateObject(String(job.payload.fileKey), String(job.payload.schoolId)),
}

/**
 * Queue deletion of a private R2 object after its database row is gone.
 * Never throws: the caller has already committed the row deletion, so a queue
 * failure is logged with the key for manual cleanup instead of failing the request.
 */
export async function enqueueObjectDeletion(
  fileKey: string | null | undefined, schoolId: string, store: DurableJobStore = durableJobStore,
) {
  if (!fileKey) return
  try {
    await store.enqueue({ jobType: DELETE_OBJECT_JOB, dedupeKey: `${DELETE_OBJECT_JOB}:${fileKey}`, payload: { fileKey, schoolId } })
  } catch (error) {
    console.error('[storage] object deletion could not be queued', { fileKey, schoolId, error })
  }
}
