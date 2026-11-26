import { describe, expect, it, vi } from 'vitest'
import { retryDelaySeconds, runDurableJobs, type DurableJob, type DurableJobStore } from './durable-jobs'

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
