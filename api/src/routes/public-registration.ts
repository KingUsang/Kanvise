import { Hono } from 'hono'
import { createHash, randomBytes } from 'node:crypto'
import { supabase } from '../lib/supabase'
import { clientAddress, createIpRateLimiter } from '../lib/ip-rate-limit'

export const publicRegistrationRouter = new Hono()

const MAX_RETURN_TO_LENGTH = 512
const intentLimiter = createIpRateLimiter({ limit: 30, windowMs: 10 * 60_000 })

function safeReturnTo(value: unknown) {
  if (typeof value !== 'string' || value.length > MAX_RETURN_TO_LENGTH || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.startsWith('/auth')) return null
  return value
}

publicRegistrationRouter.post('/registration-intents/student', async (c) => {
  const retryAfter = intentLimiter.hit(clientAddress(c))
  if (retryAfter !== null) {
    c.header('Retry-After', String(retryAfter))
    return c.json({ error: 'Too many requests. Please try again shortly.', code: 'RATE_LIMITED' }, 429)
  }
  const returnTo = safeReturnTo((await c.req.json().catch(() => ({}))).return_to)
  if (!returnTo) return c.json({ error: 'Invalid return path' }, 400)
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const { error } = await (supabase as any).from('registration_intents').insert({
    token_hash: tokenHash, kind: 'student', return_to: returnTo,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  })
  if (error) return c.json({ error: 'Could not start student registration' }, 503)
  return c.json({ token }, 201)
})
