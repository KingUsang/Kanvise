import { sendNotificationEmail } from '../emails/send-notification'
import { notificationRepository, type NotificationRepository } from './repository'
import {
  notificationEmailEvents,
  type NotificationEvent,
  type NotificationFailure,
  type NotificationRequest,
  type NotificationResult,
} from './types'

type Logger = Pick<Console, 'info' | 'error'>

export type NotificationDependencies = {
  repository: NotificationRepository
  sendEmail: typeof sendNotificationEmail
  logger: Logger
}

const defaultDependencies: NotificationDependencies = {
  repository: notificationRepository,
  sendEmail: sendNotificationEmail,
  logger: console,
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
      try {
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
      } catch (error) {
        result.failures.push({ recipientId: recipient.id, channel: 'in_app', error: errorMessage(error) })
      }

      if (!recipient.email) {
        result.skippedNoEmail += 1
        return
      }

      const key = `${request.event}:${request.relatedEntityId}:${recipient.id}`
      try {
        await dependencies.repository.createDelivery(key, request.event, recipient.email)
        const delivery = await dependencies.repository.getDelivery(key)
        if (delivery.status === 'sent') {
          result.emailsAlreadySent += 1
          return
        }

        await dependencies.repository.markDeliveryAttempt(key, delivery.attempt_count + 1)
        const emailEvent = notificationEmailEvents[request.event]
        const sent = await dependencies.sendEmail(emailEvent, {
          ...request.emailInput(recipient),
          to: recipient.email,
          idempotencyKey: key,
        } as never)
        await dependencies.repository.markDeliverySent(key, sent.id)
        result.emailsSent += 1
      } catch (error) {
        const message = errorMessage(error)
        try { await dependencies.repository.markDeliveryFailed(key, message) } catch { /* retain original failure */ }
        result.failures.push({ recipientId: recipient.id, channel: 'email', error: message })
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
