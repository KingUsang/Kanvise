import { getEmailConfig } from './config'
import { sendEmail } from './provider-router'
import { renderEmail } from './render-email'
import type { EmailTransport } from './send-tutor-invitation'
import type { EmailEventName, EmailTemplateInputs } from './types'

export async function sendNotificationEmail<K extends EmailEventName>(
  event: K,
  input: EmailTemplateInputs[K] & { to: string; idempotencyKey: string },
  transport?: EmailTransport,
) {
  const config = getEmailConfig()
  const { to, idempotencyKey, ...templateInput } = input
  const rendered = await renderEmail(event, templateInput as unknown as EmailTemplateInputs[K], config.logoUrl)
  const payload = {
    from: config.from,
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
