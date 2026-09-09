import { getEmailConfig } from './config'
import { sendEmail } from './provider-router'
import { renderEmail } from './render-email'
import type { EmailPayload, EmailTransport } from './transport'
import type { TutorInvitationEmailInput } from './types'

export type { EmailTransport } from './transport'

export type SendTutorInvitationInput = TutorInvitationEmailInput & {
  to: string
}

export async function sendTutorInvitation(
  input: SendTutorInvitationInput,
  transport?: EmailTransport,
) {
  const config = getEmailConfig()
  const { to, ...templateInput } = input
  const rendered = await renderEmail('tutor_invitation', templateInput, config.logoUrl)
  const payload: EmailPayload = {
    from: config.from,
    to: [to],
    ...rendered,
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
  }
  if (transport) {
    const { data, error } = await transport.send(payload)
    if (error) throw new Error(`Email provider could not deliver the tutor invitation: ${error.message}`)
    return { id: data?.id || null }
  }
  const delivery = await sendEmail(payload, { event: 'tutor_invitation' })
  return { id: delivery.id, provider: delivery.provider }
}
