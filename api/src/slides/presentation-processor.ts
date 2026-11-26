import { supabase } from '../lib/supabase'
import { buildPrivateFileKey, deletePrivateObject, readPrivateObject, uploadPrivateObject } from '../storage/r2'
import { MAX_SLIDE_PAGES } from './conversion-policy'
import { readPdfPageCount } from './pdf-metadata'
import { convertPdfToImages } from '../workers/pdf-converter'
import { durableJobStore, runDurableJobs, type DurableJobHandlers, type DurableJobStore } from '../jobs/durable-jobs'

const db = supabase as any

export async function processPresentation(id: string) {
  const { data: material, error } = await db.from('live_class_presentations')
    .select('id, school_id, live_class_id, file_key, processing_status').eq('id', id).maybeSingle()
  if (error || !material || material.processing_status !== 'processing') return
  const pageImageKeys: string[] = []
  try {
    const bytes = await readPrivateObject(material.file_key, material.school_id)
    const pageCount = await readPdfPageCount(bytes)
    if (pageCount < 1 || pageCount > MAX_SLIDE_PAGES) throw new Error(`PDF must contain between 1 and ${MAX_SLIDE_PAGES} pages`)
    const pageImageKeyMap: Record<string, string> = {}
    const pageImageDimensions: Record<string, { width: number; height: number }> = {}
    await convertPdfToImages(bytes, async (message) => {
      if (message.type !== 'page') return
      const pageKey = buildPrivateFileKey(
        material.school_id,
        'live_class_presentation',
        material.live_class_id,
        'jpg',
        `${material.id}-page-${message.pageNumber}`,
      )
      await uploadPrivateObject({ fileKey: pageKey, schoolId: material.school_id, body: message.buffer, contentType: 'image/jpeg' })
      pageImageKeyMap[String(message.pageNumber)] = pageKey
      if (message.width && message.height) pageImageDimensions[String(message.pageNumber)] = { width: message.width, height: message.height }
      pageImageKeys.push(pageKey)
    })
    if (Object.keys(pageImageKeyMap).length !== pageCount) throw new Error('PDF page conversion did not produce every page')
    const { error: updateError } = await db.from('live_class_presentations').update({
      processing_status: 'ready', processing_error: null, processing_started_at: null, page_count: pageCount,
      page_image_keys: pageImageKeyMap, page_image_dimensions: pageImageDimensions,
    }).eq('id', id).eq('processing_status', 'processing')
    if (updateError) throw updateError
  } catch (error) {
    await Promise.all(pageImageKeys.map((key) => deletePrivateObject(key, material.school_id).catch(() => undefined)))
    const message = error instanceof Error ? error.message : 'The PDF could not be read'
    // If this write fails, throw so the durable job is retried instead of
    // leaving the presentation in 'processing' with the job marked complete.
    const { error: failedError } = await db.from('live_class_presentations').update({
      processing_status: 'failed', processing_error: message.slice(0, 500), processing_started_at: null,
    }).eq('id', id)
    if (failedError) throw failedError
  }
}

export const PRESENTATION_JOB_TYPE = 'presentation_processing'
const STALLED_AFTER_MS = 2 * 60_000

export const presentationJobHandlers: DurableJobHandlers = {
  [PRESENTATION_JOB_TYPE]: async (job) => processPresentation(String(job.payload.presentationId)),
}

export function runPresentationJobs(store: DurableJobStore = durableJobStore) {
  return runDurableJobs({ handlers: presentationJobHandlers, store, limit: 2, leaseSeconds: 600 })
}

/**
 * Record the work durably, then try to run it straight away. If either step
 * fails, the scheduler's requeueStalledPresentations sweep recovers the row
 * because it stays in 'processing'.
 */
export async function enqueuePresentationProcessing(id: string, store: DurableJobStore = durableJobStore) {
  try {
    await store.enqueue({ jobType: PRESENTATION_JOB_TYPE, dedupeKey: `presentation:${id}`, payload: { presentationId: id } })
    void runPresentationJobs(store).catch((error) => console.error('[presentations] immediate job run failed', error))
  } catch (error) {
    console.error('[presentations] enqueue failed; the scheduler will retry', error)
  }
}

/** Restart recovery: presentations left in 'processing' get a job again. */
export async function requeueStalledPresentations(now = new Date(), store: DurableJobStore = durableJobStore) {
  const { data, error } = await db.from('live_class_presentations').select('id')
    .eq('processing_status', 'processing').lt('processing_started_at', new Date(now.getTime() - STALLED_AFTER_MS).toISOString()).limit(50)
  if (error) throw error
  for (const row of data || []) {
    await store.enqueue({ jobType: PRESENTATION_JOB_TYPE, dedupeKey: `presentation:${row.id}`, payload: { presentationId: row.id } })
  }
  return (data || []).length
}

export async function runPresentationRecoveryJob() {
  const requeued = await requeueStalledPresentations()
  const result = await runPresentationJobs()
  return { ...result, name: 'presentation_processing', requeued }
}
