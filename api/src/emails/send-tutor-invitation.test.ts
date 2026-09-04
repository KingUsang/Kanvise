import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendTutorInvitation, type EmailTransport } from './send-tutor-invitation'

const input = {
  to: 'tutor@example.com',
  inviteUrl: 'https://kanvise.com/join?token=signed-token',
  invitedByName: 'Ada Okafor',
  schoolName: 'Bright Minds Academy',
  expiresAt: '2026-07-27T12:00:00.000Z',
}

describe('sendTutorInvitation', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('renders and sends the branded invitation', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('EMAIL_FROM', 'Kanvise <noreply@kanvise.com>')
    vi.stubEnv('FRONTEND_URL', 'https://kanvise.com')

    let sent: Parameters<EmailTransport['send']>[0] | undefined
    const transport: EmailTransport = {
      async send(payload) {
        sent = payload
        return { data: { id: 'email_123' }, error: null }
      },
    }

    await expect(sendTutorInvitation(input, transport)).resolves.toEqual({ id: 'email_123' })
    expect(sent?.to).toEqual(['tutor@example.com'])
    expect(sent?.subject).toContain('Bright Minds Academy')
    expect(sent?.html).toContain('https://kanvise.com/kanvise_logo_small_blue.png')
    expect(sent?.html).toContain('Accept invitation')
    expect(sent?.text).toContain(input.inviteUrl)
  })

  it('turns provider failures into an actionable error', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('EMAIL_FROM', 'Kanvise <noreply@kanvise.com>')
    vi.stubEnv('FRONTEND_URL', 'https://kanvise.com')

    const transport: EmailTransport = {
      async send() {
        return { data: null, error: { message: 'API key rejected' } }
      },
    }

    await expect(sendTutorInvitation(input, transport)).rejects.toThrow(
      'Resend could not deliver the tutor invitation: API key rejected',
    )
  })
})
