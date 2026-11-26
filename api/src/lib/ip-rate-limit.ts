import { createHash, timingSafeEqual } from 'node:crypto'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'

// In-process fixed-window limiter keyed by client address. State lives in one
// process, so it slows abuse per instance and does not replace an edge limit
// (DEV-PUB-001).

/** Header the Next.js route handlers use to pass the visitor address. */
export const PROXY_CLIENT_IP_HEADER = 'x-kanvise-client-ip'
/** Header carrying KANVISE_PROXY_SECRET from the Next.js route handlers. */
export const PROXY_SECRET_HEADER = 'x-kanvise-proxy-secret'
const MIN_PROXY_SECRET_LENGTH = 16

type AddressContext = { req: { header(name: string): string | undefined }; env?: unknown }

function digest(value: string) {
  return createHash('sha256').update(value).digest()
}

/**
 * True only when the request carries the configured proxy secret. Hashing
 * both sides gives equal-length buffers, so the compare is constant-time and
 * does not leak the secret length. An unset or short secret trusts nobody.
 */
export function hasTrustedProxySecret(c: AddressContext, configured = process.env.KANVISE_PROXY_SECRET) {
  const secret = configured?.trim()
  const presented = c.req.header(PROXY_SECRET_HEADER)
  if (!secret || secret.length < MIN_PROXY_SECRET_LENGTH || !presented) return false
  return timingSafeEqual(digest(presented), digest(secret))
}

function plausibleAddress(value: string | undefined) {
  const candidate = value?.trim()
  return candidate && candidate.length <= 64 && /^[0-9A-Fa-f:.]+$/.test(candidate) ? candidate : null
}

function socketAddress(c: AddressContext) {
  try {
    return getConnInfo(c as unknown as Context).remote.address || null
  } catch {
    // app.request() in tests and non-Node adapters have no socket.
    return null
  }
}

/**
 * Rate-limit key for the caller (DEV-PUB-004).
 *
 * 1. The visitor address forwarded by the Kanvise web proxy, only when the
 *    request also carries KANVISE_PROXY_SECRET.
 * 2. Otherwise the last X-Forwarded-For entry. Caddy on the API host appends
 *    the address of the peer that connected to it, so a caller cannot choose
 *    the last entry. cf-connecting-ip and x-real-ip are not trusted because
 *    Caddy passes them through from the caller unchanged.
 * 3. Otherwise the socket address (direct connection to the Node server).
 */
export function clientAddress(c: AddressContext) {
  if (hasTrustedProxySecret(c)) {
    const forwardedClient = plausibleAddress(c.req.header(PROXY_CLIENT_IP_HEADER))
    if (forwardedClient) return forwardedClient
  }
  const forwarded = c.req.header('x-forwarded-for')?.split(',').map((value) => value.trim()).filter(Boolean)
  return forwarded?.at(-1)
    || socketAddress(c)
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
