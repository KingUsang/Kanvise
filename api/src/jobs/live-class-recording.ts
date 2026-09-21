import { createHash } from 'node:crypto'
import { PassThrough, Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { supabase } from '../lib/supabase'
import { buildPrivateFileKey, uploadPrivateObject, uploadPrivateStream } from '../storage/r2'
import { plugNmeet, plugNmeetClientUrl } from '../plugnmeet/client'
import { notifyClassRecapPublished } from '../notifications/triggers'

type RecordingJob = { id: string; live_class_id: string; payload: Record<string, unknown>; attempts: number }
type RecordingContext = { id: string; school_id: string; course_id: string; tutor_id: string; title: string; provider_room_id: string | null; classroom_provider: string }

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function recordingKey(schoolId: string, classId: string, recordingId: string) {
  const safeId = createHash('sha256').update(recordingId).digest('hex').slice(0, 24)
  return buildPrivateFileKey(schoolId, 'live_class_recording', classId, 'mp4', safeId)
}

function transcriptKey(schoolId: string, classId: string) {
  return buildPrivateFileKey(schoolId, 'live_class_transcript', classId, 'json')
}

async function transcribeDeepgram(stream: PassThrough, contentType = 'video/mp4') {
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
  const { data: recording, error: recordingError } = await (supabase as any).from('live_class_recordings').select('id, provider_recording_id, status, r2_file_key, content_type, file_size_bytes').eq('live_class_id', liveClass.id).maybeSingle()
  if (recordingError || !recording?.provider_recording_id) throw recordingError || new Error('Recording provider ID is missing')

  const { data: claimed } = recording.status === 'transferring' || recording.status === 'ready'
    ? { data: recording }
    : await (supabase as any).from('live_class_recordings').update({ status: 'transferring', updated_at: new Date().toISOString() }).eq('id', recording.id).eq('status', 'pending').select('id, provider_recording_id, status, r2_file_key, content_type, file_size_bytes').maybeSingle()
  if (!claimed) return

  const infoResponse = await plugNmeet.getRecordingInfo(String(claimed.provider_recording_id))
  const info = infoResponse.recording_info || {}
  const tokenResponse = await plugNmeet.getRecordingDownloadToken(String(claimed.provider_recording_id))
  if (!tokenResponse.token) throw new Error('PlugNmeet did not return a recording download token')
  const downloadResponse = await fetch(`${plugNmeetClientUrl().replace(/\/$/, '')}/download/recording/${encodeURIComponent(tokenResponse.token)}`)
  if (!downloadResponse.ok || !downloadResponse.body) throw new Error(`PlugNmeet recording download failed (${downloadResponse.status})`)

  const contentType = claimed.content_type || 'video/mp4'
  const size = Number(info.file_size || claimed.file_size_bytes || downloadResponse.headers.get('content-length') || 0) || undefined
  const fileKey = claimed.r2_file_key || recordingKey(liveClass.school_id, liveClass.id, String(claimed.provider_recording_id))
  const recordingStream = new PassThrough()
  const transcriptionStream = new PassThrough()
  const checksum = createHash('sha256')
  const writeWithBackpressure = (stream: PassThrough, chunk: Buffer) => new Promise<void>((resolve, reject) => {
    const onDrain = () => { cleanup(); resolve() }
    const onError = (error: Error) => { cleanup(); reject(error) }
    const cleanup = () => {
      stream.off('drain', onDrain)
      stream.off('error', onError)
    }
    stream.once('drain', onDrain)
    stream.once('error', onError)
    if (stream.write(chunk)) {
      cleanup()
      resolve()
    }
  })
  const splitter = new Transform({
    async transform(chunk, _encoding, callback) {
      try {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        checksum.update(buffer)
        await Promise.all([
          writeWithBackpressure(recordingStream, buffer),
          writeWithBackpressure(transcriptionStream, buffer),
        ])
        callback()
      } catch (error) {
        callback(error as Error)
      }
    },
    flush(callback) {
      recordingStream.end()
      transcriptionStream.end()
      callback()
    },
  })
  const uploadPromise = uploadPrivateStream({ fileKey, schoolId: liveClass.school_id, body: recordingStream, contentType, contentLength: size })
  const transcriptionPromise = transcribeDeepgram(transcriptionStream, contentType).catch((error) => {
    transcriptionStream.destroy(error as Error)
    throw error
  })
  await Promise.all([pipeline(Readable.fromWeb(downloadResponse.body as any), splitter), uploadPromise])
  const transcription = await transcriptionPromise

  await (supabase as any).from('live_class_recordings').update({ status: 'ready', r2_file_key: fileKey, content_type: contentType, file_size_bytes: size || null, checksum: checksum.digest('hex'), ended_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', recording.id)
  const transcriptFileKey = transcriptKey(liveClass.school_id, liveClass.id)
  await uploadPrivateObject({ fileKey: transcriptFileKey, schoolId: liveClass.school_id, body: Buffer.from(JSON.stringify({ transcript: transcription.transcript, provider: 'deepgram', metadata: transcription.metadata, created_at: new Date().toISOString() })), contentType: 'application/json' })
  const summary = await summarizeWithGemini({ title: liveClass.title, transcript: transcription.transcript })
  const draftBody = summaryBody(summary)
  const { error: recapError } = await (supabase as any).from('live_class_recaps').upsert({ live_class_id: liveClass.id, school_id: liveClass.school_id, course_id: liveClass.course_id, tutor_id: liveClass.tutor_id, draft_body: draftBody, raw_transcript_key: transcriptFileKey, status: 'draft', failure_reason: null, model_metadata: { transcription_provider: 'deepgram', summary_provider: 'gemini', summary_model: process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash' }, updated_at: new Date().toISOString() }, { onConflict: 'live_class_id' })
  if (recapError) throw recapError
}

export async function runLiveClassRecordingJob(now = new Date(), limit = 3) {
  const { data: jobs, error } = await (supabase as any).from('live_class_jobs').select('id, live_class_id, payload, attempts').eq('job_type', 'recording_process').eq('status', 'pending').lte('available_at', now.toISOString()).order('created_at', { ascending: true }).limit(limit)
  if (error) throw error
  let processed = 0
  let failures = 0
  for (const job of (jobs || []) as RecordingJob[]) {
    const { data: claimed } = await (supabase as any).from('live_class_jobs').update({ status: 'running', attempts: (job.attempts || 0) + 1 }).eq('id', job.id).eq('status', 'pending').select('id').maybeSingle()
    if (!claimed) continue
    try {
      await processRecording(job)
      await (supabase as any).from('live_class_jobs').update({ status: 'complete', completed_at: new Date().toISOString(), last_error: null }).eq('id', job.id)
      processed += 1
    } catch (jobError: any) {
      failures += 1
      const message = String(jobError?.message || jobError).slice(0, 500)
      const attempt = (job.attempts || 0) + 1
      await (supabase as any).from('live_class_jobs').update({ status: attempt >= 3 ? 'failed' : 'pending', last_error: message, available_at: new Date(Date.now() + 5 * 60_000).toISOString() }).eq('id', job.id)
      await (supabase as any).from('live_class_recordings').update({ status: attempt >= 3 ? 'failed' : 'pending', updated_at: new Date().toISOString() }).eq('live_class_id', job.live_class_id).in('status', ['transferring', 'ready'])
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
