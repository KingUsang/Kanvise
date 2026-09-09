import { getEmailConfig } from './config'
import { sendEmail } from './provider-router'
import { renderEmail } from './render-email'
import type { EmailTransport } from './send-tutor-invitation'
import type { PaymentConfirmedEmailInput } from './types'

export type SendPaymentConfirmationInput = PaymentConfirmedEmailInput & {
  to: string
  idempotencyKey: string
}

export async function sendPaymentConfirmation(input: SendPaymentConfirmationInput, transport?: EmailTransport) {
  const config = getEmailConfig()
  const { to, idempotencyKey, ...templateInput } = input
  const rendered = await renderEmail('payment_confirmed', templateInput, config.logoUrl)
  const payload = {
    from: config.from,
    to: [to],
    ...rendered,
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
  }
  if (transport) {
    const { data, error } = await transport.send(payload, { idempotencyKey })
    if (error) throw new Error(`Email provider could not deliver the payment confirmation: ${error.message}`)
    return { id: data?.id || null }
  }
  const delivery = await sendEmail(payload, { event: 'payment_confirmed', idempotencyKey })
  return { id: delivery.id, provider: delivery.provider }
}
