import { getEmailConfig } from './config'
import { sendEmail } from './provider-router'
import { renderEmail } from './render-email'
import type { EmailTransport } from './send-tutor-invitation'
import type { WelcomeEmailInput } from './types'

export type SendWelcomeInput = WelcomeEmailInput & {
  to: string
  idempotencyKey?: string
}

export async function sendWelcomeEmail(input: SendWelcomeInput, transport?: EmailTransport) {
  const config = getEmailConfig()
  const { to, idempotencyKey, ...templateInput } = input
  const rendered = await renderEmail('welcome', templateInput, config.logoUrl)
  const payload = {
    from: config.from,
    to: [to],
    ...rendered,
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
  }
  if (transport) {
    const { data, error } = await transport.send(payload, idempotencyKey ? { idempotencyKey } : undefined)
    if (error) throw new Error(`Email provider could not deliver the welcome email: ${error.message}`)
    return { id: data?.id || null }
  }
  const delivery = await sendEmail(payload, { event: 'welcome', idempotencyKey })
  return { id: delivery.id, provider: delivery.provider }
}
