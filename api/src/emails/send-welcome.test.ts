import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EmailTransport } from './send-tutor-invitation'
import { sendWelcomeEmail } from './send-welcome'

describe('sendWelcomeEmail', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('renders and sends the welcome email', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('EMAIL_FROM', 'Kanvise <noreply@kanvise.com>')
    vi.stubEnv('FRONTEND_URL', 'https://kanvise.com')

    let sent: Parameters<EmailTransport['send']>[0] | undefined
    let options: { idempotencyKey?: string } | undefined
    const transport: EmailTransport = {
      async send(payload, requestOptions) {
        sent = payload
        options = requestOptions
        return { data: { id: 'email_welcome' }, error: null }
      },
    }

    await expect(sendWelcomeEmail({
      to: 'ada@example.com',
      firstName: 'Ada',
      dashboardUrl: 'https://kanvise.com/dashboard',
      idempotencyKey: 'welcome:profile-123',
    }, transport)).resolves.toEqual({ id: 'email_welcome' })

    expect(sent?.subject).toBe('Welcome to Kanvise, Ada')
    expect(sent?.html).toContain('WELCOME TO KANVISE')
    expect(sent?.text).toContain('WELCOME, ADA.')
    expect(sent?.text).toContain('https://kanvise.com/dashboard')
    expect(options).toEqual({ idempotencyKey: 'welcome:profile-123' })
  })
})
