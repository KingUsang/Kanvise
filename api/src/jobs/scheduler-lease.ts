import { supabase } from '../lib/supabase'

type Logger = Pick<Console, 'info' | 'error' | 'warn'>

export type SchedulerLease = {
  acquire(name: string, holder: string, ttlSeconds: number): Promise<boolean>
  release(name: string, holder: string): Promise<void>
}

export const databaseSchedulerLease: SchedulerLease = {
  async acquire(name, holder, ttlSeconds) {
    const { data, error } = await (supabase as any).rpc('acquire_scheduler_lease', { p_name: name, p_holder: holder, p_ttl_seconds: ttlSeconds })
    if (error) throw error
    return Boolean(data)
  },
  async release(name, holder) {
    const { error } = await (supabase as any).rpc('release_scheduler_lease', { p_name: name, p_holder: holder })
    if (error) throw error
  },
}

/**
 * Run a job only while this process holds the database lease for its name. The
 * lease is renewed while the job runs and released afterwards, so a second
 * scheduler process skips the tick instead of running the same job concurrently.
 * If the lease cannot be obtained or checked, the tick is skipped.
 */
export function createLeasedJob<T>(name: string, job: () => Promise<T>, options: {
  lease: SchedulerLease
  holder: string
  ttlSeconds?: number
  logger?: Logger
}) {
  const { lease, holder, ttlSeconds = 120, logger = console } = options
  const leaseName = `job:${name}`
  let active: Promise<T | undefined> | null = null
  async function execute(): Promise<T | undefined> {
    let acquired = false
    try { acquired = await lease.acquire(leaseName, holder, ttlSeconds) }
    catch (error) { logger.error('job.lease_check_failed', { name, error }) }
    if (!acquired) {
      logger.info('job.lease_held_elsewhere', { name })
      return undefined
    }
    const renewal = setInterval(() => {
      lease.acquire(leaseName, holder, ttlSeconds).then((held) => {
        if (!held) logger.error('job.lease_lost', { name, holder })
      }).catch((error) => logger.error('job.lease_renew_failed', { name, error }))
    }, Math.max(1, Math.floor(ttlSeconds / 3)) * 1000)
    try { return await job() }
    finally {
      clearInterval(renewal)
      await lease.release(leaseName, holder).catch((error) => logger.error('job.lease_release_failed', { name, error }))
    }
  }
  return {
    run() {
      if (active) {
        logger.warn('job.overlap_skipped', { name })
        return active
      }
      active = execute().finally(() => { active = null })
      return active
    },
    async waitForIdle() { await active },
  }
}
