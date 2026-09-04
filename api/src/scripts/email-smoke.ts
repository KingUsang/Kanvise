import 'dotenv/config'
import { renderEmail } from '../emails/render-email'
import { sendNotificationEmail } from '../emails/send-notification'
import type { EmailEventName, EmailTemplateInputs } from '../emails/types'

const baseUrl = (process.env.FRONTEND_URL || 'https://staging.kanvise.com').replace(/\/$/, '')

export const smokeInputs: { [K in EmailEventName]: EmailTemplateInputs[K] } = {
  tutor_invitation: {
    inviteUrl: `${baseUrl}/join?token=smoke-test`, invitedByName: 'Amara Okafor',
    schoolName: 'Kanvise Demo School', expiresAt: '2026-07-27T12:00:00Z',
  },
  welcome: { firstName: 'Ada', dashboardUrl: `${baseUrl}/dashboard` },
  payment_confirmed: {
    firstName: 'Ada', schoolName: 'Kanvise Demo School', programmeName: 'WAEC Physics',
    amount: '₦25,000.00', paymentReference: 'SMOKE-PAY-001', paidAt: '2026-07-20T12:00:00Z',
    dashboardUrl: `${baseUrl}/dashboard`,
  },
  live_class_reminder: {
    firstName: 'Ada', classTitle: 'Physics Revision', courseName: 'Physics',
    startsAt: '2026-07-20T15:00:00Z', joinUrl: `${baseUrl}/class/smoke-class`,
  },
  class_cancellation: {
    firstName: 'Ada', classTitle: 'Physics Revision', scheduledAt: '2026-07-20T15:00:00Z',
    schoolName: 'Kanvise Demo School', dashboardUrl: `${baseUrl}/dashboard/schedule`, reason: 'Tutor unavailable',
  },
  assignment_deadline: {
    firstName: 'Ada', assignmentTitle: 'Mechanics Essay', courseName: 'Physics',
    deadlineAt: '2026-07-21T15:00:00Z', assignmentUrl: `${baseUrl}/dashboard/assignments/smoke-assignment`,
  },
  submission_graded: {
    firstName: 'Ada', assignmentTitle: 'Mechanics Essay', score: '85', feedback: 'Clear and well structured.',
    submissionUrl: `${baseUrl}/dashboard/submissions/smoke-submission`,
  },
  mock_published: {
    firstName: 'Ada', mockTitle: 'WAEC Physics Mock', courseName: 'Physics', closesAt: '2026-07-27T15:00:00Z',
    mockUrl: `${baseUrl}/dashboard/mocks/smoke-mock`,
  },
  mock_fully_graded: {
    firstName: 'Ada', mockTitle: 'WAEC Physics Mock', score: '42',
    resultsUrl: `${baseUrl}/dashboard/mocks/smoke-mock/results/smoke-attempt`,
  },
}

export async function runEmailSmoke() {
  const send = process.env.EMAIL_SMOKE_SEND === 'true'
  const recipient = process.env.EMAIL_SMOKE_TO?.trim()
  if (send && process.env.NODE_ENV === 'production') throw new Error('Email smoke sending is disabled in production')
  if (send && !recipient) throw new Error('EMAIL_SMOKE_TO is required when EMAIL_SMOKE_SEND=true')

  const logoUrl = process.env.EMAIL_LOGO_URL || `${baseUrl}/kanvise_logo_small_blue.png`
  const timestamp = new Date().toISOString()
  const results: Array<{ event: EmailEventName; subject: string; htmlBytes: number; textBytes: number; sentId?: string | null }> = []

  for (const event of Object.keys(smokeInputs) as EmailEventName[]) {
    const input = smokeInputs[event] as unknown as Record<string, unknown>
    const rendered = await renderEmail(event, input as never, logoUrl)
    let sentId: string | null | undefined
    if (send && recipient) {
      const delivery = await sendNotificationEmail(event, {
        ...input,
        to: recipient,
        idempotencyKey: `smoke:${event}:${timestamp}`,
      } as never)
      sentId = delivery.id
    }
    results.push({
      event, subject: rendered.subject,
      htmlBytes: Buffer.byteLength(rendered.html), textBytes: Buffer.byteLength(rendered.text),
      ...(send ? { sentId } : {}),
    })
  }
  return { mode: send ? 'send' : 'render', recipient: send ? recipient : undefined, results }
}

if (require.main === module) {
  runEmailSmoke()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
