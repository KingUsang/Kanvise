// In-process fixed-window limiter keyed by client address. State lives in one
// process, so it slows abuse per instance and does not replace an edge limit
// (DEV-PUB-001).
export function clientAddress(c: { req: { header(name: string): string | undefined } }) {
  const forwarded = c.req.header('x-forwarded-for')?.split(',').map((value) => value.trim()).filter(Boolean)
  return c.req.header('cf-connecting-ip')
    || c.req.header('x-real-ip')
    || forwarded?.at(-1)
    || 'unknown'
}

export interface IpRateLimiter {
  /** Returns seconds to wait when the key is over its limit, otherwise null. */
  hit(key: string, now?: number): number | null
}

export function createIpRateLimiter(options: { limit: number; windowMs: number; maxKeys?: number }): IpRateLimiter {
  const maxKeys = options.maxKeys ?? 5_000
  const buckets = new Map<string, { count: number; resetAt: number }>()

  function prune(now: number) {
    if (buckets.size < maxKeys) return
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
    // Still full of live buckets: drop the oldest so memory stays bounded.
    for (const key of buckets.keys()) {
      if (buckets.size < maxKeys) break
      buckets.delete(key)
    }
  }

  return {
    hit(key, now = Date.now()) {
      const bucket = buckets.get(key)
      if (bucket && bucket.resetAt > now) {
        if (bucket.count >= options.limit) return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
        bucket.count += 1
        return null
      }
      prune(now)
      buckets.set(key, { count: 1, resetAt: now + options.windowMs })
      return null
    },
  }
}
