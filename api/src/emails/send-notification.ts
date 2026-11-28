import { getEmailConfig } from './config'
import { formatFrom, type UnsubscribeLinks } from './footer'
import { sendEmail } from './provider-router'
import { renderEmail } from './render-email'
import type { EmailTransport } from './send-tutor-invitation'
import type { EmailEventName, EmailTemplateInputs } from './types'

export type NotificationEmailOptions = {
  to: string
  idempotencyKey: string
  /** 'Michael Chen' or the agency name: the email comes from "Michael Chen via Kanvise" (18 NTF-04). */
  senderName?: string | null
  /** Required when the email can be switched off. */
  unsubscribe?: UnsubscribeLinks
  /** The account's timezone for every time in the email. */
  timeZone?: string
}

export async function sendNotificationEmail<K extends EmailEventName>(
  event: K,
  input: EmailTemplateInputs[K] & NotificationEmailOptions,
  transport?: EmailTransport,
) {
  const config = getEmailConfig()
  const { to, idempotencyKey, senderName, unsubscribe, timeZone, ...templateInput } = input
  const rendered = await renderEmail(event, templateInput as unknown as EmailTemplateInputs[K], config.logoUrl, { unsubscribe, timeZone })
  const payload = {
    from: formatFrom(senderName, config.from),
    to: [to],
    ...rendered,
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
  }
  if (transport) {
    const { data, error } = await transport.send(payload, { idempotencyKey })
    if (error) throw new Error(`Email provider could not deliver ${event}: ${error.message}`)
    return { id: data?.id || null }
  }
  const delivery = await sendEmail(payload, { event, idempotencyKey })
  return { id: delivery.id, provider: delivery.provider }
}
