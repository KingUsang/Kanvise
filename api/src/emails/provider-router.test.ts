import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBrevoSender,
  createMailjetSender,
  resetEmailProviderStateForTests,
  sendUsingProviderChain,
  type ProviderSender,
} from './provider-router'
import type { EmailProviderUsageStore } from './provider-usage'

const payload = {
  from: 'Kanvise <noreply@mail.kanvise.com>',
  to: ['student@example.com'],
  subject: 'Test email',
  html: '<p>Test email</p>',
  text: 'Test email',
  replyTo: 'info@kanvise.com',
}

describe('email provider routing', () => {
  beforeEach(() => resetEmailProviderStateForTests())
  afterEach(() => vi.restoreAllMocks())

  it('uses the first healthy provider without calling the fallback', async () => {
    const resend = vi.fn<ProviderSender>().mockResolvedValue({ id: 'resend-1' })
    const brevo = vi.fn<ProviderSender>().mockResolvedValue({ id: 'brevo-1' })

    await expect(sendUsingProviderChain({
      event: 'welcome',
      idempotencyKey: 'welcome:1',
      order: ['resend', 'brevo'],
      payload,
      senders: { resend, brevo },
    })).resolves.toEqual({ id: 'resend-1', provider: 'resend' })
    expect(brevo).not.toHaveBeenCalled()
  })

  it('falls back to Brevo when Resend rejects the message', async () => {
    const resend = vi.fn<ProviderSender>().mockRejectedValue({ status: 429, message: 'Daily quota exceeded' })
    const brevo = vi.fn<ProviderSender>().mockResolvedValue({ id: 'brevo-1' })

    await expect(sendUsingProviderChain({
      event: 'welcome',
      idempotencyKey: 'welcome:2',
      order: ['resend', 'brevo'],
      payload,
      senders: { resend, brevo },
    })).resolves.toEqual({ id: 'brevo-1', provider: 'brevo' })
    expect(resend).toHaveBeenCalledOnce()
    expect(brevo).toHaveBeenCalledOnce()
  })

  it('skips a provider while its quota cooldown is active', async () => {
    const resend = vi.fn<ProviderSender>().mockRejectedValue({ status: 429, message: 'Rate limited' })
    const brevo = vi.fn<ProviderSender>().mockResolvedValue({ id: 'brevo-1' })
    const now = () => Date.parse('2026-09-09T10:00:00Z')
    const input = {
      event: 'welcome',
      order: ['resend', 'brevo'] as const,
      payload,
      senders: { resend, brevo },
      now,
    }

    await sendUsingProviderChain({ ...input, order: [...input.order], idempotencyKey: 'welcome:3' })
    await sendUsingProviderChain({ ...input, order: [...input.order], idempotencyKey: 'welcome:4' })
    expect(resend).toHaveBeenCalledOnce()
    expect(brevo).toHaveBeenCalledTimes(2)
  })

  it('switches providers when the shared daily threshold is reached', async () => {
    const resend = vi.fn<ProviderSender>().mockResolvedValue({ id: 'resend-unused' })
    const brevo = vi.fn<ProviderSender>().mockResolvedValue({ id: 'brevo-capacity' })
    const usageStore: EmailProviderUsageStore = {
      reserve: vi.fn(async ({ provider }) => provider === 'resend'
        ? { allowed: false, reason: 'threshold', used: 90, threshold: 90 }
        : { allowed: true, reason: 'reserved', used: 1, threshold: 270 }),
      record: vi.fn(async () => undefined),
    }

    await expect(sendUsingProviderChain({
      event: 'welcome',
      order: ['resend', 'brevo'],
      payload,
      senders: { resend, brevo },
      usageStore,
      dailyLimits: { resend: 100, brevo: 300, mailjet: 200 },
      usageThresholdPercent: 90,
    })).resolves.toEqual({ id: 'brevo-capacity', provider: 'brevo' })
    expect(resend).not.toHaveBeenCalled()
    expect(brevo).toHaveBeenCalledOnce()
    expect(usageStore.record).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'brevo', succeeded: true, recipientCount: 1,
    }))
  })

  it('maps Kanvise email fields to the Brevo HTTP API without exposing the key in the body', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ messageId: '<brevo-message-id>' }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    ))
    const sender = createBrevoSender('xkeysib-secret', fetchMock)

    await expect(sender(payload, {
      event: 'welcome',
      idempotencyKey: 'welcome:profile-123',
    })).resolves.toEqual({ id: '<brevo-message-id>' })

    const [, request] = fetchMock.mock.calls[0]
    expect(request?.headers).toMatchObject({ 'api-key': 'xkeysib-secret' })
    const body = JSON.parse(String(request?.body))
    expect(body.sender).toEqual({ name: 'Kanvise', email: 'noreply@mail.kanvise.com' })
    expect(body.replyTo).toEqual({ email: 'info@kanvise.com' })
    expect(body.headers.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(String(request?.body)).not.toContain('xkeysib-secret')
  })

  it('maps Kanvise email fields to Mailjet and uses Basic authentication', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({
        Messages: [{
          Status: 'success',
          To: [{ Email: 'student@example.com', MessageUUID: 'mailjet-uuid', MessageID: 123 }],
        }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const sender = createMailjetSender('public-key', 'private-key', fetchMock)

    await expect(sender(payload, {
      event: 'welcome',
      idempotencyKey: 'welcome:profile-123',
    })).resolves.toEqual({ id: 'mailjet-uuid' })

    const [, request] = fetchMock.mock.calls[0]
    expect(request?.headers).toMatchObject({
      authorization: `Basic ${Buffer.from('public-key:private-key').toString('base64')}`,
    })
    const body = JSON.parse(String(request?.body))
    expect(body.Messages[0]).toMatchObject({
      From: { Email: 'noreply@mail.kanvise.com', Name: 'Kanvise' },
      To: [{ Email: 'student@example.com' }],
      ReplyTo: { Email: 'info@kanvise.com' },
      Subject: 'Test email',
      HTMLPart: '<p>Test email</p>',
      TextPart: 'Test email',
    })
    expect(body.Messages[0].CustomID).toMatch(/^[0-9a-f-]{36}$/)
    expect(String(request?.body)).not.toContain('private-key')
  })

  it('falls through when Mailjet returns a message-level error', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({
        Messages: [{
          Status: 'error',
          Errors: [{ ErrorCode: 'send-0008', ErrorMessage: 'Sender is not authorized' }],
        }],
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    ))
    const mailjet = createMailjetSender('public-key', 'private-key', fetchMock)
    const brevo = vi.fn<ProviderSender>().mockResolvedValue({ id: 'brevo-2' })

    await expect(sendUsingProviderChain({
      event: 'welcome',
      order: ['mailjet', 'brevo'],
      payload,
      senders: { mailjet, brevo },
    })).resolves.toEqual({ id: 'brevo-2', provider: 'brevo' })
  })
})
