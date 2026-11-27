import { sendNotificationEmail } from '../emails/send-notification'
import { notificationRepository, type NotificationRepository } from './repository'
import {
  notificationEmailEvents,
  type NotificationEvent,
  type NotificationFailure,
  type NotificationRequest,
  type NotificationResult,
} from './types'
import { sendWebPushNotification } from '../push/service'
import { holdSentClaim, retryWrite } from '../lib/retry-write'

type Logger = Pick<Console, 'info' | 'error'>

export type NotificationDependencies = {
  repository: NotificationRepository
  sendEmail: typeof sendNotificationEmail
  logger: Logger
  sendPush?: typeof sendWebPushNotification
}

const defaultDependencies: NotificationDependencies = {
  repository: notificationRepository,
  sendEmail: sendNotificationEmail,
  logger: console,
  sendPush: sendWebPushNotification,
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown notification error'
}

export async function deliverNotification<K extends NotificationEvent>(
  request: NotificationRequest<K>,
  dependencies: NotificationDependencies = defaultDependencies,
): Promise<NotificationResult> {
  const result: NotificationResult = {
    event: request.event,
    recipients: 0,
    inAppCreated: 0,
    emailsSent: 0,
    emailsAlreadySent: 0,
    skippedNoEmail: 0,
    pushSent: 0,
    pushAlreadySent: 0,
    pushSkipped: 0,
    failures: [],
  }

  let recipients
  try {
    recipients = await dependencies.repository.resolveRecipients(request.schoolId, request.recipients)
  } catch (error) {
    const message = errorMessage(error)
    result.failures.push({ recipientId: '*', channel: 'recipient', error: message })
    dependencies.logger.error('notification.recipient_resolution_failed', {
      schoolId: request.schoolId, event: request.event, error: message,
    })
    return result
  }

  const tenantRecipients = recipients.filter((recipient) => {
    if (recipient.schoolId === request.schoolId) return true
    result.failures.push({
      recipientId: recipient.id,
      channel: 'recipient',
      error: 'Recipient does not belong to the notification tenant',
    })
    return false
  })
  result.recipients = tenantRecipients.length
  const batchSize = Math.max(1, Math.min(request.batchSize ?? 25, 100))

  for (let offset = 0; offset < tenantRecipients.length; offset += batchSize) {
    const batch = tenantRecipients.slice(offset, offset + batchSize)
    await Promise.all(batch.map(async (recipient) => {
      const channelKey = (channel: 'in_app' | 'push' | 'email') => ({
        schoolId: request.schoolId, event: request.event, relatedEntityId: request.relatedEntityId, recipientId: recipient.id, channel,
      })
      // Channel state is bookkeeping only: a failure to read or write it must
      // never block delivery or turn into a delivery failure.
      const alreadySent = async (channel: 'in_app' | 'push' | 'email') => {
        try { return Boolean(await dependencies.repository.channelAlreadySent?.(channelKey(channel))) } catch { return false }
      }
      const record = async (channel: 'in_app' | 'push' | 'email', status: 'sent' | 'failed' | 'skipped', message?: string) => {
        try { await dependencies.repository.recordChannel?.(channelKey(channel), status, message) } catch (error) {
          dependencies.logger.error('notification.channel_state_write_failed', { channel, error: errorMessage(error) })
        }
      }

      if (!await alreadySent('in_app')) try {
        const created = await dependencies.repository.createInApp({
          schoolId: request.schoolId,
          recipientId: recipient.id,
          event: request.event,
          title: request.title,
          body: request.body,
          relatedEntityType: request.relatedEntityType,
          relatedEntityId: request.relatedEntityId,
        })
        if (created) result.inAppCreated += 1
        await record('in_app', 'sent')
      } catch (error) {
        result.failures.push({ recipientId: recipient.id, channel: 'in_app', error: errorMessage(error) })
        await record('in_app', 'failed', errorMessage(error))
      }

      if (!await alreadySent('push')) try {
        const push = await (dependencies.sendPush || sendWebPushNotification)({
          userId: recipient.id,
          schoolId: request.schoolId,
          event: request.event,
          relatedEntityId: request.relatedEntityId,
          payload: {
            title: request.title,
            body: request.push.body,
            url: request.push.url,
            tag: `${request.event}:${request.relatedEntityId}`,
          },
        })
        result.pushSent += push.sent
        result.pushAlreadySent += push.alreadySent
        result.pushSkipped += push.skipped
        for (const failure of push.failures) {
          result.failures.push({ recipientId: recipient.id, channel: 'push', error: failure.error })
        }
        if (push.failures.length) await record('push', 'failed', push.failures[0].error)
        else await record('push', push.sent || push.alreadySent ? 'sent' : 'skipped')
      } catch (error) {
        result.failures.push({ recipientId: recipient.id, channel: 'push', error: errorMessage(error) })
        await record('push', 'failed', errorMessage(error))
      }

      const emailEvent = notificationEmailEvents[request.event]
      if (!emailEvent || !request.emailInput) return
      if (!recipient.email) {
        result.skippedNoEmail += 1
        await record('email', 'skipped', 'Recipient has no email address')
        return
      }
      if (await alreadySent('email')) {
        result.emailsAlreadySent += 1
        return
      }

      const key = `${request.event}:${request.relatedEntityId}:${recipient.id}`
      let providerAccepted = false
      try {
        await dependencies.repository.createDelivery(key, request.event, recipient.email)
        const delivery = await dependencies.repository.getDelivery(key)
        if (delivery.status === 'sent') {
          result.emailsAlreadySent += 1
          await record('email', 'sent')
          return
        }

        // Atomic claim: another worker holding the delivery means it is theirs to send.
        if (!await dependencies.repository.claimDelivery(key)) {
          result.emailsAlreadySent += 1
          return
        }
        const sent = await dependencies.sendEmail(emailEvent, {
          ...request.emailInput(recipient),
          to: recipient.email,
          idempotencyKey: key,
        } as never)
        providerAccepted = true
        result.emailsSent += 1
        // The provider accepted the message. If the ledger write keeps failing the
        // delivery stays claimed (and the claim is held for a day) rather than failed, so it is not re-sent.
        const recorded = await retryWrite(() => dependencies.repository.markDeliverySent(key, sent.id))
        if (!recorded) {
          dependencies.logger.error('notification.email_sent_state_write_failed', { key })
          await holdSentClaim('email_deliveries', key)
        }
        await record('email', 'sent')
      } catch (error) {
        if (providerAccepted) return
        const message = errorMessage(error)
        try { await dependencies.repository.markDeliveryFailed(key, message) } catch { /* retain original failure */ }
        result.failures.push({ recipientId: recipient.id, channel: 'email', error: message })
        await record('email', 'failed', message)
      }
    }))
  }

  const logContext = {
    schoolId: request.schoolId,
    relatedEntityType: request.relatedEntityType,
    relatedEntityId: request.relatedEntityId,
    ...result,
    failureCount: result.failures.length,
  }
  if (result.failures.length) dependencies.logger.error('notification.delivery_partial_failure', logContext)
  else dependencies.logger.info('notification.delivery_complete', logContext)
  return result
}
