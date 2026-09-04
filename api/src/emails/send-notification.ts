import { Resend } from 'resend'
import { getEmailConfig } from './config'
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
  const client = transport || new Resend(config.apiKey).emails
  const { data, error } = await client.send({
    from: config.from,
    to: [to],
    ...rendered,
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
  }, { idempotencyKey })

  if (error) throw new Error(`Resend could not deliver ${event}: ${error.message}`)
  return { id: data?.id || null }
}
