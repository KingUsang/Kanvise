import { describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))
import { durableJobStore, retryDelaySeconds, runDurableJobs, type DurableJob, type DurableJobStore } from './durable-jobs'

function store(jobs: DurableJob[]): DurableJobStore & { complete: any; fail: any } {
  return {
    enqueue: vi.fn(async () => 'id'),
    claim: vi.fn(async () => jobs),
    complete: vi.fn(async () => true),
    fail: vi.fn(async () => true),
  }
}
const job = (overrides: Partial<DurableJob> = {}): DurableJob => ({ id: 'j1', job_type: 't', payload: {}, attempts: 1, max_attempts: 5, ...overrides })
const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }

describe('runDurableJobs', () => {
  it('runs a pending job found after a restart and completes it', async () => {
    const s = store([job({ payload: { presentationId: 'p1' } })])
    const handler = vi.fn(async () => {})
    const result = await runDurableJobs({ handlers: { t: handler }, store: s, worker: 'w', logger })
    expect(s.claim).toHaveBeenCalledWith(['t'], 'w', 3, 300)
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ payload: { presentationId: 'p1' } }))
    expect(s.complete).toHaveBeenCalledWith('j1', 'w')
    expect(result).toMatchObject({ processed: 1, failures: 0 })
  })

  it('records a failure with backoff and does not complete the job', async () => {
    const s = store([job({ attempts: 3 })])
    const result = await runDurableJobs({ handlers: { t: async () => { throw new Error('r2 down') } }, store: s, worker: 'w', logger })
    expect(s.complete).not.toHaveBeenCalled()
    expect(s.fail).toHaveBeenCalledWith('j1', 'w', 'r2 down', 120)
    expect(result).toMatchObject({ processed: 0, failures: 1 })
  })

  it('fails a job with no handler', async () => {
    const s = store([job({ job_type: 'other' })])
    await runDurableJobs({ handlers: { t: async () => {} }, store: s, worker: 'w', logger })
    expect(s.fail).toHaveBeenCalledWith('j1', 'w', 'No handler for job type other', 30)
  })

  it('extends the lease while a handler runs and reports a lost lease', async () => {
    vi.useFakeTimers()
    try {
      const s = store([job()])
      s.extend = vi.fn(async () => false)
      s.complete = vi.fn(async () => false) as any
      const warn = vi.fn()
      const run = runDurableJobs({
        handlers: { t: () => new Promise<void>((resolve) => setTimeout(resolve, 5_000)) },
        store: s, worker: 'w', leaseSeconds: 3, logger: { ...logger, warn },
      })
      await vi.advanceTimersByTimeAsync(5_000)
      const result = await run
      expect(s.extend).toHaveBeenCalledWith('j1', 'w', 3)
      expect(warn).toHaveBeenCalledWith('durable_job.lease_lost', expect.anything())
      expect(warn).toHaveBeenCalledWith('durable_job.complete_lease_lost', expect.anything())
      expect(result).toMatchObject({ processed: 0 })
    } finally { vi.useRealTimers() }
  })

  it('caps backoff at one hour', () => {
    expect(retryDelaySeconds(1)).toBe(30)
    expect(retryDelaySeconds(20)).toBe(3600)
  })
})

describe('durable job operator actions (DEV-INT-003)', () => {
  it('cancels and replays through the dedicated RPCs', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    await expect(durableJobStore.cancel!('job-1')).resolves.toBe(true)
    await expect(durableJobStore.replay!('job-1')).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('cancel_durable_job', { p_id: 'job-1' })
    expect(rpc).toHaveBeenCalledWith('replay_durable_job', { p_id: 'job-1' })
  })

  it('reports false when the job is not in a cancellable or replayable state', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    await expect(durableJobStore.replay!('running-job')).resolves.toBe(false)
  })
})
