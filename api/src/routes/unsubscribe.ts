import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { apiError, validationError } from '../lib/api-contract'
import { clientAddress, createIpRateLimiter, type IpRateLimiter } from '../lib/ip-rate-limit'
import {
  lookupUnsubscribe,
  supabaseUnsubscribeStore,
  undoUnsubscribe,
  unsubscribe,
  type UnsubscribeStore,
} from '../notifications/unsubscribe'

/**
 * Public unsubscribe routes (18 NTF-04, NTF-08). No sign-in: possession of the
 * token from the email allows exactly one thing, switching that email row off
 * or back on (standard 03, share links).
 *
 * The page sends the token in the body, not the URL, so it stays out of logs
 * (standard 03). Only the RFC 8058 one-click endpoint takes it in the query,
 * because mail apps POST to the exact URL in the List-Unsubscribe header.
 */
export const unsubscribeRouter = new Hono()

// Per address, per process (DEV-PUB-001). One-click requests come from mail
// providers' servers, so that limit is higher.
let pageLimiter: IpRateLimiter = createIpRateLimiter({ limit: 30, windowMs: 10 * 60_000 })
let oneClickLimiter: IpRateLimiter = createIpRateLimiter({ limit: 600, windowMs: 10 * 60_000 })
let store: UnsubscribeStore = supabaseUnsubscribeStore

/** Tests only. */
export function configureUnsubscribeRoutes(options: { store?: UnsubscribeStore; pageLimiter?: IpRateLimiter; oneClickLimiter?: IpRateLimiter }) {
  store = options.store ?? supabaseUnsubscribeStore
  pageLimiter = options.pageLimiter ?? createIpRateLimiter({ limit: 30, windowMs: 10 * 60_000 })
  oneClickLimiter = options.oneClickLimiter ?? createIpRateLimiter({ limit: 600, windowMs: 10 * 60_000 })
}

// Any string up to 200 characters is accepted here; a token that is not the
// right shape gets the same "expired" answer as an unknown one.
const bodySchema = z.object({ token: z.string().max(200) }).strict()

function limited(c: Context, limiter: IpRateLimiter) {
  const retryAfter = limiter.hit(clientAddress(c))
  if (retryAfter === null) return null
  c.header('Retry-After', String(retryAfter))
  return apiError(c, 429, 'RATE_LIMITED', 'Too many requests. Try again in a moment.')
}

async function readToken(c: Context): Promise<string> {
  const raw = await c.req.text()
  if (raw.length > 1_000) throw validationError('The request is too large.')
  let body: unknown
  try { body = JSON.parse(raw) } catch { throw validationError('The request body must be JSON.') }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) throw validationError('token is required.', 'token')
  return parsed.data.token
}

function respond(c: Context, data: unknown) {
  c.header('Cache-Control', 'no-store')
  return c.json({ data })
}

// What the page shows first. Read only: mail scanners prefetch links.
unsubscribeRouter.post('/lookup', async (c) => {
  const blocked = limited(c, pageLimiter)
  if (blocked) return blocked
  return respond(c, await lookupUnsubscribe(await readToken(c), store))
})

unsubscribeRouter.post('/', async (c) => {
  const blocked = limited(c, pageLimiter)
  if (blocked) return blocked
  return respond(c, await unsubscribe(await readToken(c), store))
})

unsubscribeRouter.post('/undo', async (c) => {
  const blocked = limited(c, pageLimiter)
  if (blocked) return blocked
  return respond(c, await undoUnsubscribe(await readToken(c), store))
})

// RFC 8058: the mail app POSTs `List-Unsubscribe=One-Click` as a form body to
// the URL from the List-Unsubscribe header.
unsubscribeRouter.post('/one-click', async (c) => {
  const blocked = limited(c, oneClickLimiter)
  if (blocked) return blocked
  const raw = await c.req.text()
  if (raw.length > 1_000) throw validationError('The request is too large.')
  if (new URLSearchParams(raw).get('List-Unsubscribe') !== 'One-Click') {
    throw validationError('Expected List-Unsubscribe=One-Click.', 'List-Unsubscribe')
  }
  const token = c.req.query('token')
  return respond(c, await unsubscribe(typeof token === 'string' && token.length <= 200 ? token : '', store))
})
