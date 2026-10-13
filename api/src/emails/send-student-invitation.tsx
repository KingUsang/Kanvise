import { getEmailConfig } from './config'
import { sendEmail } from './provider-router'
import { renderEmail } from './render-email'

export async function sendStudentInvitation(input: {
  to: string
  inviteUrl: string
  invitedByName: string
  schoolName: string
  programmeName: string
  expiresAt: string
}) {
  const config = getEmailConfig()
  const { to, ...templateInput } = input
  const rendered = await renderEmail('student_invitation', templateInput, config.logoUrl)
  const delivery = await sendEmail({
    from: config.from,
    to: [to],
    ...rendered,
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
  }, { event: 'student_invitation' })
  return { id: delivery.id, provider: delivery.provider }
}
