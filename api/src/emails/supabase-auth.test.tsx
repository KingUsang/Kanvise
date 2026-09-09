import { describe, expect, it, vi } from 'vitest'
import { buildSupabaseAuthMessages, deliverSupabaseAuthEmail, type SupabaseSendEmailHookPayload } from './supabase-auth'

const basePayload: SupabaseSendEmailHookPayload = {
  user: { id: 'user-1', email: 'student@example.com' },
  email_data: {
    email_action_type: 'signup',
    token: '305805',
    token_hash: 'signup-hash',
    redirect_to: 'https://kanvise.com/dashboard/student',
    site_url: 'https://kanvise.com',
  },
}

describe('Supabase auth email delivery', () => {
  it('builds the OTP-first signup message expected by the registration UI', () => {
    expect(buildSupabaseAuthMessages(basePayload, 'https://example.supabase.co')).toEqual([
      expect.objectContaining({
        recipient: 'student@example.com',
        code: '305805',
        subject: 'Confirm your Kanvise email',
        actionUrl: undefined,
      }),
    ])
  })

  it('creates a Supabase verification link for invitations', () => {
    const [message] = buildSupabaseAuthMessages({
      ...basePayload,
      email_data: { ...basePayload.email_data, email_action_type: 'invite' },
    }, 'https://example.supabase.co')
    const url = new URL(message.actionUrl!)
    expect(`${url.origin}${url.pathname}`).toBe('https://example.supabase.co/auth/v1/verify')
    expect(url.searchParams.get('token')).toBe('signup-hash')
    expect(url.searchParams.get('type')).toBe('invite')
  })

  it('uses Supabase’s reversed secure email-change token/hash mapping', () => {
    const messages = buildSupabaseAuthMessages({
      user: { id: 'user-1', email: 'old@example.com', new_email: 'new@example.com' },
      email_data: {
        email_action_type: 'email_change',
        token: '111111',
        token_hash_new: 'current-email-hash',
        token_new: '222222',
        token_hash: 'new-email-hash',
      },
    }, 'https://example.supabase.co')
    expect(messages).toEqual([
      expect.objectContaining({ recipient: 'old@example.com', code: '111111', suffix: 'email_change_current' }),
      expect.objectContaining({ recipient: 'new@example.com', code: '222222', suffix: 'email_change_new' }),
    ])
    expect(messages[0].actionUrl).toContain('token=current-email-hash')
    expect(messages[1].actionUrl).toContain('token=new-email-hash')
  })

  it('renders and sends through the shared provider router contract', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'provider-id', provider: 'resend' })
    await deliverSupabaseAuthEmail({
      env: {
        FRONTEND_URL: 'https://kanvise.com',
        SUPABASE_URL: 'https://example.supabase.co',
        RESEND_API_KEY: 're_test',
        EMAIL_FROM: 'Kanvise <noreply@mail.kanvise.com>',
      } as NodeJS.ProcessEnv,
      payload: basePayload,
      send,
      webhookId: 'webhook-1',
    })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: ['student@example.com'],
      subject: 'Confirm your Kanvise email',
      html: expect.stringContaining('305805'),
    }), expect.objectContaining({
      event: 'supabase_auth.signup',
      idempotencyKey: 'supabase-auth:webhook-1:signup:student@example.com',
      providerTimeoutMs: 1250,
    }))
  })
})
