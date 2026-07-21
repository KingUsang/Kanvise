import { Resend } from 'resend'
import { getEmailConfig } from './config'
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
  const client = transport || new Resend(config.apiKey).emails
  const { data, error } = await client.send({
    from: config.from,
    to: [to],
    ...rendered,
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
  }, { idempotencyKey })

  if (error) throw new Error(`Resend could not deliver the payment confirmation: ${error.message}`)
  return { id: data?.id || null }
}

