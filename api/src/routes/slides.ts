import { Hono } from 'hono'
import { Worker } from 'node:worker_threads'
import path from 'node:path'
import crypto from 'node:crypto'
import { supabase } from '../lib/supabase'
import {
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  tenantMiddleware,
  requireRole,
} from '../middleware/auth'
import { deleteStoredObject, publicFileKeyFromUrl, uploadPublicObject } from '../storage/r2'
import {
  createConversionDeadline,
  MAX_SLIDE_PAGES,
  SlideConversionValidationError,
  validateSlidePdf,
} from '../slides/conversion-policy'

export const slidesRouter = new Hono()

// In-memory store for MVP. If we scale, this goes to Redis.
type SlideJob = {
  classId: string
  schoolId: string
  status: 'processing' | 'complete' | 'error'
  slides?: string[]
  error?: string
}
const jobs = new Map<string, SlideJob>()

const uploadWithRetry = async (fileKey: string, buffer: Buffer, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadPublicObject({ fileKey, body: buffer, contentType: 'image/jpeg' })
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`[slides] Upload failed after ${maxRetries} attempts:`, error)
        throw error
      }
      await new Promise(res => setTimeout(res, 1000 * attempt))
    }
  }
}

async function cleanupSlideKeys(keys: string[]) {
  await Promise.allSettled(keys.map(key => deleteStoredObject(key)))
}

// ── Apply auth middleware to all routes ────────────────────────────────────
slidesRouter.use(
  '/*',
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  tenantMiddleware,
)

// ── POST /live-classes/:id/slides/upload — Upload and convert PDF ──────────
// TODO(auth): Remove 'admin' role bypass after MVP testing is complete
slidesRouter.post('/:id/slides/upload', requireRole('tutor', 'admin'), async (c) => {
  const user = (c as any).get('user')
  const { id } = c.req.param()

  // 1. Validate the class and get existing slides for cleanup
  const { data: liveClass, error: fetchError } = await supabase
    .from('live_classes')
    .select('tutor_id, status, slides_urls')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .single()

  if (fetchError || !liveClass) {
    return c.json({ error: 'Class not found', code: 'NOT_FOUND' }, 404)
  }

  if (liveClass.tutor_id !== user.id) {
    return c.json({ error: 'You are not the tutor for this class', code: 'NOT_CLASS_TUTOR' }, 403)
  }

  if (liveClass.status !== 'live') {
    return c.json({ error: 'Class must be live to upload slides', code: 'CLASS_NOT_LIVE' }, 400)
  }

  // 2. Parse the multipart form data
  const formData = await c.req.parseBody()
  let file: File
  try {
    file = validateSlidePdf(formData['file'] as File | undefined)
  } catch (error) {
    if (error instanceof SlideConversionValidationError) {
      return c.json({ error: error.message, code: error.code }, 400)
    }
    throw error
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdfBuffer = Buffer.from(arrayBuffer)
  
  const jobId = crypto.randomUUID()
  const jobScope = { classId: id, schoolId: user.school_id }
  jobs.set(jobId, { ...jobScope, status: 'processing' })

  // 3. Spawn Worker Thread
  const workerPath = path.resolve(__dirname, '../workers/pdf-converter.ts')
  // Note: Since we are using tsx/ts-node, we must run the TS file. In production (dist/), this would point to pdf-converter.js
  const extension = path.extname(__filename) // .ts in dev, .js in prod
  const actualWorkerPath = workerPath.replace('.ts', extension)

  // We need to use a special worker setup when using tsx in dev.
  // A cleaner approach that works in both is just relying on the compiled JS in prod.
  // But for dev with tsx, we can pass execArgv to register tsx if needed.
  const workerOptions = extension === '.ts' 
    ? { workerData: { pdfBuffer }, execArgv: ['--import', 'tsx'] } 
    : { workerData: { pdfBuffer } }

  const worker = new Worker(actualWorkerPath, workerOptions)

  let uploadQueue = Promise.resolve()
  const slideUrls: string[] = []
  const uploadedKeys: string[] = []
  const setJob = (job: Omit<SlideJob, 'classId' | 'schoolId'>) => {
    jobs.set(jobId, { ...jobScope, ...job })
  }
  const cancelDeadline = createConversionDeadline(async () => {
    if (jobs.get(jobId)?.status !== 'processing') return
    setJob({ status: 'error', error: 'PDF conversion timed out. Please try a smaller file.' })
    await worker.terminate()
    await uploadQueue
    await cleanupSlideKeys(uploadedKeys)
  })

  worker.on('message', (message) => {
    if (message.type === 'start') {
      if (message.numPages > MAX_SLIDE_PAGES) {
        cancelDeadline()
        setJob({ status: 'error', error: `PDF exceeds ${MAX_SLIDE_PAGES} pages limit.` })
        worker.terminate()
      }
    } else if (message.type === 'page') {
      // Process uploads sequentially to prevent Supabase rate limits / socket errors
      uploadQueue = uploadQueue.then(async () => {
        if (jobs.get(jobId)?.status === 'error') return // Skip if already failed
        
        const { pageNumber, buffer } = message
        const fileKey = `schools/${user.school_id}/public/live_class_slide/${id}/${jobId}/page-${pageNumber}.jpg`
        
        try {
          const uploaded = await uploadWithRetry(fileKey, buffer)
          uploadedKeys.push(fileKey)
          slideUrls[pageNumber - 1] = uploaded!.publicUrl
        } catch (err: any) {
          cancelDeadline()
          setJob({ status: 'error', error: `Failed to upload page ${pageNumber}` })
          await cleanupSlideKeys(uploadedKeys)
          worker.terminate()
        }
      })
    } else if (message.type === 'complete') {
      uploadQueue = uploadQueue.then(async () => {
        if (jobs.get(jobId)?.status === 'error') return
        
        try {
          // Save new slides to database
          const { error: updateError } = await supabase
            .from('live_classes')
            .update({ slides_urls: slideUrls })
            .eq('id', id)
            .eq('school_id', user.school_id)
          if (updateError) throw updateError

          // Only remove the old objects after the new URLs are durable in the DB.
          const oldKeys = (liveClass.slides_urls || [])
            .map((url: string) => publicFileKeyFromUrl(url))
            .filter(Boolean) as string[]
          await cleanupSlideKeys(oldKeys)

          cancelDeadline()
          setJob({ status: 'complete', slides: slideUrls })
        } catch (err: any) {
          console.error('[slides] Cleanup/DB update failed:', err)
          await cleanupSlideKeys(uploadedKeys)
          cancelDeadline()
          setJob({ status: 'error', error: 'Failed to finalize upload in database' })
        }
      })
    } else if (message.type === 'error') {
      console.error('[slides] Worker returned error:', message.error)
      cancelDeadline()
      void cleanupSlideKeys(uploadedKeys)
      setJob({ status: 'error', error: message.error })
    }
  })

  worker.on('error', (err) => {
    console.error('[slides] Worker thread error:', err)
    cancelDeadline()
    void cleanupSlideKeys(uploadedKeys)
    setJob({ status: 'error', error: 'Worker thread crashed' })
  })

  // 4. Return immediately with 202 Accepted
  return c.json({ data: { job_id: jobId } }, 202)
})


// ── GET /live-classes/:id/slides/status/:job_id — Poll for completion ──────
// TODO(auth): Remove 'admin' role bypass after MVP testing is complete
slidesRouter.get('/:id/slides/status/:job_id', requireRole('tutor', 'student', 'admin'), async (c) => {
  const user = (c as any).get('user')
  const { id, job_id } = c.req.param()
  
  const job = jobs.get(job_id)
  
  if (!job || job.classId !== id || job.schoolId !== user.school_id) {
    return c.json({ error: 'Job not found', code: 'NOT_FOUND' }, 404)
  }
  
  return c.json({ data: { status: job.status, slides: job.slides, error: job.error } })
})
