import { Hono } from 'hono'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware } from '../middleware/auth'
import { getPushConfig } from '../push/config'
import { pushRepository } from '../push/repository'
import type { TenantVariables } from '../types'

export const pushRouter = new Hono<{ Variables: TenantVariables }>()
pushRouter.use('/*', jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware)

function parseSubscription(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  const keys = body.keys as Record<string, unknown> | undefined
  if (typeof body.endpoint !== 'string' || body.endpoint.length > 4096) return null
  try { if (new URL(body.endpoint).protocol !== 'https:') return null } catch { return null }
  if (!keys || typeof keys.p256dh !== 'string' || !keys.p256dh || keys.p256dh.length > 512) return null
  if (typeof keys.auth !== 'string' || !keys.auth || keys.auth.length > 256) return null
  const expirationTime = body.expirationTime === null || body.expirationTime === undefined ? null : Number(body.expirationTime)
  if (expirationTime !== null && (!Number.isFinite(expirationTime) || expirationTime <= 0)) return null
  return { endpoint: body.endpoint, p256dh: keys.p256dh, auth: keys.auth, expirationTime: expirationTime ? new Date(expirationTime).toISOString() : null }
}

pushRouter.get('/config', c => {
  const config = getPushConfig()
  return c.json({ data: config })
})

pushRouter.put('/subscriptions', async c => {
  const user = c.get('user')
  const subscription = parseSubscription(await c.req.json().catch(() => null))
  if (!subscription) return c.json({ error: 'Invalid push subscription', code: 'VALIDATION_ERROR' }, 400)
  if (!getPushConfig().enabled) return c.json({ error: 'Browser notifications are not enabled', code: 'PUSH_DISABLED' }, 503)
  const saved = await pushRepository.upsertSubscription({
    userId: user.id, schoolId: user.school_id, ...subscription,
    userAgent: c.req.header('user-agent')?.slice(0, 512) || null,
  })
  return c.json({ data: { id: saved.id, enabled: true } })
})

pushRouter.delete('/subscriptions', async c => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => null) as { endpoint?: unknown } | null
  if (!body || typeof body.endpoint !== 'string' || body.endpoint.length > 4096) {
    return c.json({ error: 'A valid subscription endpoint is required', code: 'VALIDATION_ERROR' }, 400)
  }
  await pushRepository.deleteSubscription(user.id, body.endpoint)
  return c.body(null, 204)
})
