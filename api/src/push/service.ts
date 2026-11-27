import webpush from 'web-push'
import { configureWebPush } from './config'
import { pushRepository } from './repository'
import { holdSentClaim, retryWrite } from '../lib/retry-write'
import type { NotificationEvent } from '../notifications/types'

export type PushPayload = { title: string; body: string; url: string; tag: string }
export type PushDeliveryResult = { sent: number; alreadySent: number; skipped: number; failures: Array<{ error: string }> }

function statusCode(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : undefined
}

export async function sendWebPushNotification(input: {
  userId: string; schoolId: string; event: NotificationEvent; relatedEntityId: string; payload: PushPayload
}): Promise<PushDeliveryResult> {
  const result: PushDeliveryResult = { sent: 0, alreadySent: 0, skipped: 0, failures: [] }
  const config = configureWebPush()
  if (!config.enabled) return result
  const subscriptions = await pushRepository.listSubscriptions(input.userId, input.schoolId)

  for (const subscription of subscriptions) {
    // A locally known-expired endpoint is removed instead of attempted (DEV-PSH-003).
    if (subscription.expiration_time && new Date(subscription.expiration_time).getTime() <= Date.now()) {
      try { await pushRepository.deleteSubscriptionById(subscription.id) } catch (error) { console.error('push.expired_subscription_cleanup_failed', error) }
      result.skipped += 1
      continue
    }
    const key = `${input.event}:${input.relatedEntityId}:${input.userId}:${subscription.id}`
    let sentToProvider = false
    try {
      const delivery = await pushRepository.beginDelivery({
        key, subscriptionId: subscription.id, userId: input.userId, schoolId: input.schoolId, event: input.event,
      })
      if (delivery.status === 'sent') {
        result.alreadySent += 1
        continue
      }
      if (!await pushRepository.claim(key)) {
        result.alreadySent += 1
        continue
      }
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        expirationTime: subscription.expiration_time ? new Date(subscription.expiration_time).getTime() : null,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify(input.payload), { TTL: 60 * 60 * 24 })
      sentToProvider = true
      result.sent += 1
      // Delivered. A failing ledger write is retried and never turns the push into a failure.
      if (!await retryWrite(() => pushRepository.markSent(key))) {
        console.error('push.sent_state_write_failed', { key })
        await holdSentClaim('push_deliveries', key)
      }
    } catch (error) {
      if (sentToProvider) continue
      const code = statusCode(error)
      if (code === 404 || code === 410) {
        await pushRepository.deleteSubscriptionById(subscription.id)
        result.skipped += 1
        continue
      }
      const message = error instanceof Error ? error.message : 'Web Push delivery failed'
      try { await pushRepository.markFailed(key, message) } catch { /* retain delivery failure */ }
      result.failures.push({ error: message })
    }
  }
  return result
}
