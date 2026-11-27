import { deletePrivateObject, deleteStoredObject } from '../storage/r2'
import { supabase } from '../lib/supabase'
import { durableJobStore, type DurableJobHandlers, type DurableJobStore } from './durable-jobs'

export const DELETE_OBJECT_JOB = 'delete_private_object'
export const DELETE_PUBLIC_OBJECT_JOB = 'delete_public_object'

export const storageCleanupHandlers: DurableJobHandlers = {
  // Deleting a missing object succeeds in R2, so the job is safe to re-run.
  [DELETE_OBJECT_JOB]: async (job) => deletePrivateObject(String(job.payload.fileKey), String(job.payload.schoolId)),
  [DELETE_PUBLIC_OBJECT_JOB]: async (job) => deleteStoredObject(String(job.payload.fileKey)),
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

/** Queue deletion of a replaced public R2 object. Never throws, like enqueueObjectDeletion. */
export async function enqueuePublicObjectDeletion(
  fileKey: string | null | undefined, schoolId: string, store: DurableJobStore = durableJobStore,
) {
  if (!fileKey) return
  try {
    await store.enqueue({ jobType: DELETE_PUBLIC_OBJECT_JOB, dedupeKey: `${DELETE_PUBLIC_OBJECT_JOB}:${fileKey}`, payload: { fileKey, schoolId } })
  } catch (error) {
    console.error('[storage] public object deletion could not be queued', { fileKey, schoolId, error })
  }
}

/**
 * Expire unconfirmed upload intents and delete question images that were never
 * attached to a question. Each database function queues the object deletions in
 * the same transaction (DEV-UPL-002, DEV-UPL-003).
 */
export async function runUploadOrphanSweep(client: Pick<typeof supabase, 'rpc'> = supabase) {
  const intents = await client.rpc('sweep_upload_intents', { p_limit: 200 })
  if (intents.error) throw intents.error
  const media = await client.rpc('sweep_orphan_question_media', { p_limit: 100 })
  if (media.error) throw media.error
  return { expiredIntents: Number(intents.data ?? 0), orphanQuestionMedia: Number(media.data ?? 0) }
}
