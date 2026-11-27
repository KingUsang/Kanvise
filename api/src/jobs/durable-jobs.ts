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
  extend?(id: string, worker: string, leaseSeconds: number): Promise<boolean>
  /** Operator actions. Dead-lettered jobs are status 'failed'. */
  cancel?(id: string): Promise<boolean>
  replay?(id: string): Promise<boolean>
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
  async extend(id, worker, leaseSeconds) {
    const { data, error } = await db.rpc('extend_durable_job_lease', { p_id: id, p_worker: worker, p_lease_seconds: leaseSeconds })
    if (error) throw error
    return Boolean(data)
  },
  async cancel(id) {
    const { data, error } = await db.rpc('cancel_durable_job', { p_id: id })
    if (error) throw error
    return Boolean(data)
  },
  async replay(id) {
    const { data, error } = await db.rpc('replay_durable_job', { p_id: id })
    if (error) throw error
    return Boolean(data)
  },
}

/** List dead-lettered (failed) jobs, newest first, for operators. */
export async function listDeadLetterJobs(limit = 50, accountId?: string) {
  let query = db.from('durable_jobs')
    .select('id, job_type, dedupe_key, attempts, max_attempts, last_error, updated_at')
    .eq('status', 'failed')
  // Jobs carry no account column; the owning account is recorded in the payload.
  if (accountId) query = query.or(`payload->>schoolId.eq.${accountId},payload->>school_id.eq.${accountId}`)
  const { data, error } = await query.order('updated_at', { ascending: false }).limit(Math.max(1, Math.min(limit, 200)))
  if (error) throw error
  return (data || []) as Array<{ id: string; job_type: string; dedupe_key: string; attempts: number; max_attempts: number; last_error: string | null; updated_at: string }>
}

/** Account that owns a job, read from its payload. Null when the job is not attributable. */
export function jobAccountId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  const value = record.schoolId ?? record.school_id
  return typeof value === 'string' ? value : null
}

export async function getDurableJob(id: string) {
  const { data, error } = await db.from('durable_jobs')
    .select('id, job_type, status, payload').eq('id', id).maybeSingle()
  if (error) throw error
  return (data || null) as { id: string; job_type: string; status: string; payload: Record<string, unknown> } | null
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
    // Keep the lease alive while the handler runs, so a slow job (or a late job in
    // the batch) is not claimed by a second worker.
    const heartbeat = store.extend ? setInterval(() => {
      store.extend!(job.id, worker, leaseSeconds).then((held) => {
        if (!held) logger.warn('durable_job.lease_lost', { jobId: job.id, jobType: job.job_type })
      }).catch((error) => logger.error('durable_job.lease_extend_failed', { jobId: job.id, error }))
    }, Math.max(1, Math.floor(leaseSeconds / 3)) * 1000) : null
    try {
      if (!handler) throw new Error(`No handler for job type ${job.job_type}`)
      await handler(job)
      if (heartbeat) clearInterval(heartbeat)
      if (await store.complete(job.id, worker)) processed += 1
      else logger.warn('durable_job.complete_lease_lost', { jobId: job.id, jobType: job.job_type })
    } catch (error) {
      failures += 1
      const message = error instanceof Error ? error.message : String(error)
      logger.error('durable_job.failed', { jobId: job.id, jobType: job.job_type, attempts: job.attempts, error: message })
      if (heartbeat) clearInterval(heartbeat)
      const recorded = await store.fail(job.id, worker, message, retryDelaySeconds(job.attempts)).catch((failError) => {
        // The lease expiry will return the job to the queue.
        logger.error('durable_job.fail_record_failed', { jobId: job.id, error: failError })
        return true
      })
      if (!recorded) logger.warn('durable_job.fail_lease_lost', { jobId: job.id, jobType: job.job_type })
    } finally {
      if (heartbeat) clearInterval(heartbeat)
    }
  }
  return { name: 'durable_jobs', processed, failures }
}
