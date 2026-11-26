import { randomUUID } from 'node:crypto'
import { supabase } from '../lib/supabase'

type Logger = Pick<Console, 'info' | 'error' | 'warn'>

export type DurableJob = {
  id: string
  job_type: string
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
}

export type DurableJobStore = {
  enqueue(input: { jobType: string; dedupeKey: string; payload?: Record<string, unknown>; runAt?: Date; maxAttempts?: number }): Promise<string>
  claim(jobTypes: string[], worker: string, limit: number, leaseSeconds: number): Promise<DurableJob[]>
  complete(id: string, worker: string): Promise<boolean>
  fail(id: string, worker: string, message: string, retrySeconds: number): Promise<boolean>
}

const db = supabase as any

export const durableJobStore: DurableJobStore = {
  async enqueue({ jobType, dedupeKey, payload = {}, runAt = new Date(), maxAttempts = 5 }) {
    const { data, error } = await db.rpc('enqueue_durable_job', {
      p_job_type: jobType, p_dedupe_key: dedupeKey, p_payload: payload, p_run_at: runAt.toISOString(), p_max_attempts: maxAttempts,
    })
    if (error) throw error
    return String(data)
  },
  async claim(jobTypes, worker, limit, leaseSeconds) {
    const { data, error } = await db.rpc('claim_durable_jobs', {
      p_job_types: jobTypes, p_worker: worker, p_limit: limit, p_lease_seconds: leaseSeconds,
    })
    if (error) throw error
    return (data || []) as DurableJob[]
  },
  async complete(id, worker) {
    const { data, error } = await db.rpc('complete_durable_job', { p_id: id, p_worker: worker })
    if (error) throw error
    return Boolean(data)
  },
  async fail(id, worker, message, retrySeconds) {
    const { data, error } = await db.rpc('fail_durable_job', { p_id: id, p_worker: worker, p_error: message, p_retry_seconds: retrySeconds })
    if (error) throw error
    return Boolean(data)
  },
}

export const workerId = `${process.env.HOSTNAME || 'api'}:${process.pid}:${randomUUID().slice(0, 8)}`

export type DurableJobHandlers = Record<string, (job: DurableJob) => Promise<void>>

export function retryDelaySeconds(attempts: number) {
  return Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1))
}

/**
 * Claim a bounded batch and run each job with its handler. A handler that
 * throws is retried with backoff until max_attempts, then recorded as failed.
 * Handlers must be idempotent: a crashed worker's job is re-run after its lease
 * expires.
 */
export async function runDurableJobs(options: {
  handlers: DurableJobHandlers
  store?: DurableJobStore
  worker?: string
  limit?: number
  leaseSeconds?: number
  logger?: Logger
}) {
  const { handlers, store = durableJobStore, worker = workerId, limit = 3, leaseSeconds = 300, logger = console } = options
  const jobs = await store.claim(Object.keys(handlers), worker, limit, leaseSeconds)
  let processed = 0
  let failures = 0
  for (const job of jobs) {
    const handler = handlers[job.job_type]
    try {
      if (!handler) throw new Error(`No handler for job type ${job.job_type}`)
      await handler(job)
      await store.complete(job.id, worker)
      processed += 1
    } catch (error) {
      failures += 1
      const message = error instanceof Error ? error.message : String(error)
      logger.error('durable_job.failed', { jobId: job.id, jobType: job.job_type, attempts: job.attempts, error: message })
      await store.fail(job.id, worker, message, retryDelaySeconds(job.attempts)).catch((failError) => {
        // The lease expiry will return the job to the queue.
        logger.error('durable_job.fail_record_failed', { jobId: job.id, error: failError })
      })
    }
  }
  return { name: 'durable_jobs', processed, failures }
}
