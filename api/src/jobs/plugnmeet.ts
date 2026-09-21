import { randomUUID } from 'node:crypto'
import { supabase } from '../lib/supabase'
import { generateAudioRecap } from '../plugnmeet/quick-check'
import { deletePrivateObject, uploadPrivateObject } from '../storage/r2'

/**
 * Turns the durable room-finished job into a tutor-editable recap draft.
 * Publication remains an explicit tutor action, so this job can never notify
 * students by itself.
 */
export async function runPlugNmeetRecapJob(limit = 10) {
  const { data: jobs, error } = await (supabase as any).from('live_class_jobs').select('id, live_class_id, attempts').eq('job_type', 'class_recap').eq('status', 'pending').lte('available_at', new Date().toISOString()).order('created_at', { ascending: true }).limit(limit)
  if (error) throw error
  let processed = 0
  let failures = 0
  for (const job of jobs || []) {
    const { data: claimed } = await (supabase as any).from('live_class_jobs').update({ status: 'running', attempts: Number(job.attempts || 0) + 1 }).eq('id', job.id).eq('status', 'pending').select('id').maybeSingle()
    if (!claimed) continue
    try {
      const [{ data: liveClass }, { data: chunks }] = await Promise.all([
        (supabase as any).from('live_classes').select('id, school_id, title').eq('id', job.live_class_id).maybeSingle(),
        (supabase as any).from('live_class_transcript_chunks').select('sequence_number, text, started_at, ended_at').eq('live_class_id', job.live_class_id).eq('is_final', true).order('sequence_number', { ascending: true }),
      ])
      if (!liveClass) throw new Error('CLASS_NOT_FOUND')
      const transcript = (chunks || []).map((chunk: any) => String(chunk.text || '')).join(' ').slice(0, 12_000)
      if (transcript.length < 300) throw new Error('NOT_ENOUGH_TRANSCRIPT')
      const recap = await generateAudioRecap(transcript)
      const rawKey = `schools/${liveClass.school_id}/private/live_class_transcript/${liveClass.id}/${randomUUID()}.json`
      try {
        await uploadPrivateObject({ fileKey: rawKey, schoolId: liveClass.school_id, body: Buffer.from(JSON.stringify({ live_class_id: liveClass.id, chunks }), 'utf8'), contentType: 'application/json' })
      } catch (storageError) {
        // R2 is required in production, but a local/staging job can still
        // create a draft when credentials are intentionally absent.
        console.warn('[plugnmeet/recap] raw transcript storage skipped:', storageError)
      }
      const { error: recapError } = await (supabase as any).from('live_class_recaps').upsert({ live_class_id: liveClass.id, school_id: liveClass.school_id, draft_body: recap, raw_transcript_key: rawKey, status: 'draft', updated_at: new Date().toISOString() }, { onConflict: 'live_class_id' })
      if (recapError) throw recapError
      await (supabase as any).from('live_class_jobs').update({ status: 'complete', completed_at: new Date().toISOString(), last_error: null }).eq('id', job.id)
      processed += 1
    } catch (error) {
      failures += 1
      await (supabase as any).from('live_class_jobs').update({ status: 'failed', last_error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }).eq('id', job.id)
      console.error('[plugnmeet/recap] job failed:', error)
    }
  }
  await purgeExpiredRawTranscripts()
  return { processed, failures }
}

async function purgeExpiredRawTranscripts() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()
  const { data: recaps } = await (supabase as any).from('live_class_recaps').select('id, school_id, raw_transcript_key').eq('status', 'published').not('raw_transcript_key', 'is', null).lt('published_at', cutoff).limit(50)
  for (const recap of recaps || []) {
    try {
      await deletePrivateObject(recap.raw_transcript_key, recap.school_id)
      await (supabase as any).from('live_class_recaps').update({ raw_transcript_key: null, updated_at: new Date().toISOString() }).eq('id', recap.id)
    } catch (error) {
      console.warn('[plugnmeet/recap] raw transcript cleanup skipped:', error)
    }
  }
}
