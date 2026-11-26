import { describe, expect, it, vi } from 'vitest'
import { createLeasedJob, type SchedulerLease } from './scheduler-lease'

function fakeLease() {
  const holders = new Map<string, string>()
  const lease: SchedulerLease = {
    async acquire(name, holder) {
      const current = holders.get(name)
      if (current && current !== holder) return false
      holders.set(name, holder)
      return true
    },
    async release(name, holder) { if (holders.get(name) === holder) holders.delete(name) },
  }
  return lease
}
const logger = () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })

describe('createLeasedJob', () => {
  it('does not let two scheduler instances run the same job concurrently', async () => {
    const lease = fakeLease()
    let running = 0
    let maxRunning = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const work = async () => { running += 1; maxRunning = Math.max(maxRunning, running); await gate; running -= 1; return 'ran' }
    const a = createLeasedJob('mock_publication', work, { lease, holder: 'a', logger: logger() })
    const b = createLeasedJob('mock_publication', work, { lease, holder: 'b', logger: logger() })

    const first = a.run()
    await Promise.resolve(); await Promise.resolve()
    const second = b.run()
    release()
    expect(await first).toBe('ran')
    expect(await second).toBeUndefined()
    expect(maxRunning).toBe(1)
  })

  it('releases the lease after the job so another instance can run next tick', async () => {
    const lease = fakeLease()
    const work = vi.fn(async () => 'ok')
    const a = createLeasedJob('x', work, { lease, holder: 'a', logger: logger() })
    const b = createLeasedJob('x', work, { lease, holder: 'b', logger: logger() })
    await a.run()
    expect(await b.run()).toBe('ok')
    expect(work).toHaveBeenCalledTimes(2)
  })

  it('releases the lease when the job throws', async () => {
    const lease = fakeLease()
    const a = createLeasedJob('x', async () => { throw new Error('boom') }, { lease, holder: 'a', logger: logger() })
    await expect(a.run()).rejects.toThrow('boom')
    expect(await lease.acquire('job:x', 'b', 10)).toBe(true)
  })

  it('skips the tick when the lease cannot be checked', async () => {
    const lease: SchedulerLease = { async acquire() { throw new Error('db down') }, async release() {} }
    const work = vi.fn(async () => 'ok')
    const log = logger()
    const job = createLeasedJob('x', work, { lease, holder: 'a', logger: log })
    expect(await job.run()).toBeUndefined()
    expect(work).not.toHaveBeenCalled()
    expect(log.error).toHaveBeenCalled()
  })
})
