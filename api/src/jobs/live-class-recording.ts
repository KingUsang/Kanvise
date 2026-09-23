import { supabase } from '../lib/supabase'
import { buildPrivateFileKey, createPresignedDownload, uploadPrivateObject } from '../storage/r2'
import { plugNmeet } from '../plugnmeet/client'
import { notifyClassRecapPublished } from '../notifications/triggers'

type RecordingJob = { id: string; job_type: 'recording_process' | 'recording_finalize'; live_class_id: string; payload: Record<string, unknown>; attempts: number }
type RecordingContext = { id: string; school_id: string; course_id: string; tutor_id: string; title: string; provider_room_id: string | null; classroom_provider: string }

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function transcriptKey(schoolId: string, classId: string) {
  return buildPrivateFileKey(schoolId, 'live_class_transcript', classId, 'json')
}

async function transcribeDeepgram(stream: NodeJS.ReadableStream, contentType = 'video/mp4') {
  const apiKey = requiredEnv('DEEPGRAM_API_KEY')
  const url = new URL('https://api.deepgram.com/v1/listen')
  url.searchParams.set('model', process.env.DEEPGRAM_MODEL || 'nova-3')
  url.searchParams.set('smart_format', 'true')
  url.searchParams.set('punctuate', 'true')
  url.searchParams.set('diarize', 'false')
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': contentType },
    body: stream as any,
    duplex: 'half',
  } as any)
  const body = await response.json().catch(() => null) as any
  if (!response.ok) throw new Error(`Deepgram transcription failed (${response.status}): ${body?.err_msg || body?.message || 'unknown error'}`)
  const transcript = String(body?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').trim()
  if (!transcript) throw new Error('Deepgram returned an empty transcript')
  return { transcript, metadata: body?.metadata || null }
}

async function summarizeWithGemini(input: { title: string; transcript: string }) {
  const apiKey = requiredEnv('GEMINI_API_KEY')
  const model = process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash'
  const prompt = `Create a clear, factual class summary for enrolled students.
Class: ${input.title}

Use only the tutor transcript below. Do not invent facts. Return JSON with exactly these string fields:
topics_covered, key_explanations, important_terms_or_formulas, homework_or_action_items, revision_points.
Each field should be concise Markdown suitable for a student.

Tutor transcript:
${input.transcript.slice(0, 120_000)}`
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
  })
  const body = await response.json().catch(() => null) as any
  if (!response.ok) throw new Error(`Gemini summary failed (${response.status}): ${body?.error?.message || 'unknown error'}`)
  const raw = body?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('').trim()
  if (!raw) throw new Error('Gemini returned an empty summary')
  try {
    const parsed = JSON.parse(raw)
    return Object.fromEntries(['topics_covered', 'key_explanations', 'important_terms_or_formulas', 'homework_or_action_items', 'revision_points'].map((key) => [key, String(parsed[key] || '').trim()]))
  } catch {
    throw new Error('Gemini returned an invalid summary')
  }
}

function summaryBody(summary: Record<string, string>) {
  return [
    ['Topics covered', summary.topics_covered],
    ['Key explanations', summary.key_explanations],
    ['Important terms and formulas', summary.important_terms_or_formulas],
    ['Homework and action items', summary.homework_or_action_items],
    ['Revision points', summary.revision_points],
  ].filter(([, value]) => value).map(([heading, value]) => `## ${heading}\n${value}`).join('\n\n')
}

async function loadContext(classId: string): Promise<RecordingContext> {
  const { data, error } = await (supabase as any).from('live_classes').select('id, school_id, course_id, tutor_id, title, provider_room_id, classroom_provider').eq('id', classId).maybeSingle()
  if (error || !data) throw error || new Error('Live class not found')
  if (data.classroom_provider !== 'plugnmeet' || !data.course_id) throw new Error('Only enrolled PlugNmeet classes can be processed')
  return data as RecordingContext
}

async function processRecording(job: RecordingJob) {
  const liveClass = await loadContext(job.live_class_id)
  const { data: recording, error: recordingError } = await (supabase as any).from('live_class_recordings').select('id, r2_file_key, content_type').eq('live_class_id', liveClass.id).eq('status', 'ready').maybeSingle()
  if (recordingError || !recording?.r2_file_key) throw recordingError || new Error('A verified R2 recording is not available yet')

  // Recorders upload to R2 themselves. Reading a short-lived signed URL keeps
  // the summary worker independent from PlugNmeet and avoids buffering video.
  const downloadUrl = await createPresignedDownload(recording.r2_file_key, liveClass.school_id, 60 * 30)
  const downloadResponse = await fetch(downloadUrl)
  if (!downloadResponse.ok || !downloadResponse.body) throw new Error(`R2 recording download failed (${downloadResponse.status})`)
  const transcription = await transcribeDeepgram(downloadResponse.body as any, recording.content_type || 'video/mp4')
  const transcriptFileKey = transcriptKey(liveClass.school_id, liveClass.id)
  await uploadPrivateObject({ fileKey: transcriptFileKey, schoolId: liveClass.school_id, body: Buffer.from(JSON.stringify({ transcript: transcription.transcript, provider: 'deepgram', metadata: transcription.metadata, created_at: new Date().toISOString() })), contentType: 'application/json' })
  const summary = await summarizeWithGemini({ title: liveClass.title, transcript: transcription.transcript })
  const draftBody = summaryBody(summary)
  const { error: recapError } = await (supabase as any).from('live_class_recaps').upsert({ live_class_id: liveClass.id, school_id: liveClass.school_id, course_id: liveClass.course_id, tutor_id: liveClass.tutor_id, draft_body: draftBody, raw_transcript_key: transcriptFileKey, status: 'draft', failure_reason: null, model_metadata: { transcription_provider: 'deepgram', summary_provider: 'gemini', summary_model: process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash' }, updated_at: new Date().toISOString() }, { onConflict: 'live_class_id' })
  if (recapError) throw recapError
}

async function finalizeRecording(job: RecordingJob) {
  const liveClass = await loadContext(job.live_class_id)
  const { data: segments, error } = await (supabase as any).from('live_class_recording_segments')
    .select('provider_recording_id, r2_file_key, content_type, file_size_bytes, checksum, ended_at')
    .eq('live_class_id', liveClass.id).eq('status', 'uploaded').order('created_at', { ascending: true })
  if (error) throw error
  if (!segments?.length) throw new Error('Waiting for recorder upload')

  if (segments.length === 1) {
    const segment = segments[0]
    const { error: recordingError } = await (supabase as any).from('live_class_recordings').upsert({
      live_class_id: liveClass.id, provider_recording_id: segment.provider_recording_id, r2_file_key: segment.r2_file_key,
      status: 'ready', content_type: segment.content_type, file_size_bytes: segment.file_size_bytes, checksum: segment.checksum,
      ended_at: segment.ended_at || new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'live_class_id' })
    if (recordingError) throw recordingError
    const { error: jobError } = await (supabase as any).from('live_class_jobs').upsert({
      job_type: 'recording_process', live_class_id: liveClass.id, payload: {}, status: 'pending', available_at: new Date().toISOString(),
    }, { onConflict: 'job_type,live_class_id' })
    if (jobError) throw jobError
    return false
  }

  await plugNmeet.mergeRecordings({ room_id: String(liveClass.provider_room_id), recording_ids: segments.map((segment: any) => segment.provider_recording_id) })
  // PlugNmeet sends recording_proceeded when its asynchronous merge finishes.
  // That event assigns the merged record ID; its recorder hook then supplies
  // the verified R2 object before any student can view it.
  await (supabase as any).from('live_class_jobs').update({ status: 'waiting', payload: { merge_requested: true } }).eq('id', job.id)
  return true
}

export async function runLiveClassRecordingJob(now = new Date(), limit = 3) {
  const { data: jobs, error } = await (supabase as any).from('live_class_jobs').select('id, job_type, live_class_id, payload, attempts').in('job_type', ['recording_process', 'recording_finalize']).eq('status', 'pending').lte('available_at', now.toISOString()).order('created_at', { ascending: true }).limit(limit)
  if (error) throw error
  let processed = 0
  let failures = 0
  for (const job of (jobs || []) as RecordingJob[]) {
    const { data: claimed } = await (supabase as any).from('live_class_jobs').update({ status: 'running', attempts: (job.attempts || 0) + 1 }).eq('id', job.id).eq('status', 'pending').select('id').maybeSingle()
    if (!claimed) continue
    try {
      const waitingForMerge = job.job_type === 'recording_finalize' && await finalizeRecording(job)
      if (waitingForMerge) {
        processed += 1
        continue
      }
      if (job.job_type === 'recording_process') await processRecording(job)
      await (supabase as any).from('live_class_jobs').update({ status: 'complete', completed_at: new Date().toISOString(), last_error: null }).eq('id', job.id)
      processed += 1
    } catch (jobError: any) {
      failures += 1
      const message = String(jobError?.message || jobError).slice(0, 500)
      const attempt = (job.attempts || 0) + 1
      await (supabase as any).from('live_class_jobs').update({ status: attempt >= 3 ? 'failed' : 'pending', last_error: message, available_at: new Date(Date.now() + 5 * 60_000).toISOString() }).eq('id', job.id)
      // Recording delivery and AI processing are intentionally independent:
      // students can still watch a verified R2 video if Deepgram/Gemini fails.
      await (supabase as any).from('live_class_recaps').upsert({ live_class_id: job.live_class_id, status: 'failed', failure_reason: message, updated_at: new Date().toISOString() }, { onConflict: 'live_class_id' })
      console.error('[recording] processing failed', { liveClassId: job.live_class_id, error: message })
    }
  }
  return { name: 'live_class_recording', processed, failures }
}

export async function publishClassRecap(input: { classId: string; tutorId: string; body: string }) {
  const { data: liveClass, error: classError } = await (supabase as any).from('live_classes').select('id, school_id, course_id, title, tutor_id, classroom_provider').eq('id', input.classId).maybeSingle()
  if (classError || !liveClass || liveClass.classroom_provider !== 'plugnmeet' || !liveClass.course_id) throw classError || new Error('Enrolled PlugNmeet class not found')
  if (liveClass.tutor_id !== input.tutorId) throw new Error('Only the assigned tutor can publish this summary')
  const draft = input.body.trim().slice(0, 20_000)
  if (!draft) throw new Error('Summary body is required')
  const { data, error } = await (supabase as any).from('live_class_recaps').upsert({ live_class_id: input.classId, school_id: liveClass.school_id, course_id: liveClass.course_id, tutor_id: liveClass.tutor_id, draft_body: draft, published_body: draft, status: 'published', approved_by: input.tutorId, published_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'live_class_id' }).select('id, live_class_id, published_body, status, published_at').single()
  if (error) throw error
  await notifyClassRecapPublished({ id: input.classId, schoolId: liveClass.school_id, courseId: liveClass.course_id, title: liveClass.title })
  return data
}
