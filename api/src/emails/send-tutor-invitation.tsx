import { Resend } from 'resend'
import { getEmailConfig } from './config'
import { renderEmail } from './render-email'
import type { TutorInvitationEmailInput } from './types'

type EmailPayload = {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  replyTo?: string
}

export type EmailTransport = {
  send(payload: EmailPayload, options?: { idempotencyKey?: string }): Promise<{
    data: { id: string } | null
    error: { message: string } | null
  }>
}

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
  const client = transport || new Resend(config.apiKey).emails
  const payload: EmailPayload = {
    from: config.from,
    to: [to],
    ...rendered,
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
  }
  const { data, error } = await client.send(payload)

  if (error) {
    throw new Error(`Resend could not deliver the tutor invitation: ${error.message}`)
  }

  return { id: data?.id || null }
}
