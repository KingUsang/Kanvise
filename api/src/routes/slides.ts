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

export const slidesRouter = new Hono()

// In-memory store for MVP. If we scale, this goes to Redis.
const jobs = new Map<string, { status: 'processing' | 'complete' | 'error', slides?: string[], error?: string }>()

const uploadWithRetry = async (fileName: string, buffer: Buffer, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { error } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET!)
      .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true })
      
    if (!error) return true
    
    if (attempt === maxRetries) {
      console.error(`[slides] Upload failed after ${maxRetries} attempts:`, error)
      throw error
    }
    await new Promise(res => setTimeout(res, 1000 * attempt)) // Exponential backoff
  }
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
  const file = formData['file'] as File

  if (!file) {
    return c.json({ error: 'No file provided', code: 'NO_FILE' }, 400)
  }

  if (file.type !== 'application/pdf') {
    return c.json({ error: 'Only PDF files are allowed', code: 'INVALID_FILE_TYPE' }, 400)
  }

  // Enforce 25MB limit here
  const MAX_SIZE = 25 * 1024 * 1024 // 25MB
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File exceeds 25MB limit. Please compress your PDF.', code: 'FILE_TOO_LARGE' }, 400)
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdfBuffer = Buffer.from(arrayBuffer)
  
  const jobId = crypto.randomUUID()
  jobs.set(jobId, { status: 'processing' })

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

  worker.on('message', (message) => {
    if (message.type === 'start') {
      if (message.numPages > 50) {
        jobs.set(jobId, { status: 'error', error: 'PDF exceeds 50 pages limit.' })
        worker.terminate()
      }
    } else if (message.type === 'page') {
      // Process uploads sequentially to prevent Supabase rate limits / socket errors
      uploadQueue = uploadQueue.then(async () => {
        if (jobs.get(jobId)?.status === 'error') return // Skip if already failed
        
        const { pageNumber, buffer } = message
        const fileName = `${id}/${jobId}/page-${pageNumber}.jpg`
        
        try {
          await uploadWithRetry(fileName, buffer)
          const { data } = supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET!)
            .getPublicUrl(fileName)
            
          slideUrls[pageNumber - 1] = data.publicUrl
        } catch (err: any) {
          jobs.set(jobId, { status: 'error', error: `Failed to upload page ${pageNumber}` })
          worker.terminate()
        }
      })
    } else if (message.type === 'complete') {
      uploadQueue = uploadQueue.then(async () => {
        if (jobs.get(jobId)?.status === 'error') return
        
        try {
          // Cleanup old slides from storage if they exist
          if (liveClass.slides_urls && liveClass.slides_urls.length > 0) {
            const pathsToDelete = liveClass.slides_urls.map((url: string) => {
              const parts = url.split('/slides/')
              return parts.length > 1 ? parts[1] : null
            }).filter(Boolean) as string[]
            
            if (pathsToDelete.length > 0) {
              await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET!).remove(pathsToDelete)
            }
          }
          
          // Save new slides to database
          await supabase
            .from('live_classes')
            .update({ slides_urls: slideUrls })
            .eq('id', id)
            
          jobs.set(jobId, { status: 'complete', slides: slideUrls })
        } catch (err: any) {
          console.error('[slides] Cleanup/DB update failed:', err)
          jobs.set(jobId, { status: 'error', error: 'Failed to finalize upload in database' })
        }
      })
    } else if (message.type === 'error') {
      console.error('[slides] Worker returned error:', message.error)
      jobs.set(jobId, { status: 'error', error: message.error })
    }
  })

  worker.on('error', (err) => {
    console.error('[slides] Worker thread error:', err)
    jobs.set(jobId, { status: 'error', error: 'Worker thread crashed' })
  })

  // 4. Return immediately with 202 Accepted
  return c.json({ data: { job_id: jobId } }, 202)
})


// ── GET /live-classes/:id/slides/status/:job_id — Poll for completion ──────
// TODO(auth): Remove 'admin' role bypass after MVP testing is complete
slidesRouter.get('/:id/slides/status/:job_id', requireRole('tutor', 'student', 'admin'), async (c) => {
  const { job_id } = c.req.param()
  
  const job = jobs.get(job_id)
  
  if (!job) {
    return c.json({ error: 'Job not found', code: 'NOT_FOUND' }, 404)
  }
  
  return c.json({ data: job })
})
