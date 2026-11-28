import { describe, expect, it, vi } from 'vitest'
import { buildUnsubscribeLinks, formatFrom, unsubscribeHeaders } from './footer'
import { createBrevoSender, createMailjetSender, createResendSender } from './provider-router'

const headers = {
  'List-Unsubscribe': '<https://api.kanvise.com/unsubscribe/one-click?token=t>',
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
}
const payload = {
  from: '"Michael Chen via Kanvise" <noreply@mail.kanvise.com>',
  to: ['student@example.com'],
  subject: 'Reminder',
  html: '<p>Reminder</p>',
  text: 'Reminder',
  headers,
}

function fetchDouble(body: unknown) {
  return vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body), { status: 200 }))
}

describe('formatFrom (NTF-04)', () => {
  it('puts the tutor or agency name before "via Kanvise"', () => {
    expect(formatFrom('Michael Chen', 'Kanvise <noreply@kanvise.com>')).toBe('"Michael Chen via Kanvise" <noreply@kanvise.com>')
    expect(formatFrom('Science Students Academy', 'noreply@kanvise.com')).toBe('"Science Students Academy via Kanvise" <noreply@kanvise.com>')
  })

  it('keeps the configured sender when there is no name', () => {
    expect(formatFrom(null, 'Kanvise <noreply@kanvise.com>')).toBe('Kanvise <noreply@kanvise.com>')
    expect(formatFrom('  ', 'Kanvise <noreply@kanvise.com>')).toBe('Kanvise <noreply@kanvise.com>')
  })

  it('strips quotes and line breaks and caps the length', () => {
    expect(formatFrom('Evil"\r\nBcc: x@y.z <a>', 'noreply@kanvise.com')).toBe('"Evil Bcc: x@y.z a via Kanvise" <noreply@kanvise.com>')
    const long = formatFrom('A'.repeat(200), 'noreply@kanvise.com')
    expect(long.match(/^"(.*)" </)![1].length).toBeLessThanOrEqual(70)
    expect(long).toContain('… via Kanvise')
  })
})

describe('unsubscribe links and headers', () => {
  it('builds the page link on the web and the one-click link on the API', () => {
    expect(buildUnsubscribeLinks('a b', { FRONTEND_URL: 'https://kanvise.com/', API_PUBLIC_URL: 'https://api.kanvise.com' } as never)).toEqual({
      pageUrl: 'https://kanvise.com/unsubscribe?token=a%20b',
      oneClickUrl: 'https://api.kanvise.com/unsubscribe/one-click?token=a%20b',
    })
    expect(buildUnsubscribeLinks('t', { FRONTEND_URL: 'https://kanvise.com' } as never).oneClickUrl).toBeNull()
  })

  it('uses RFC 8058 one-click headers when it can', () => {
    expect(unsubscribeHeaders({ pageUrl: 'https://kanvise.com/unsubscribe?token=t', oneClickUrl: 'https://api.kanvise.com/unsubscribe/one-click?token=t' }))
      .toEqual(headers)
  })
})

describe('List-Unsubscribe reaches every provider', () => {
  it('Resend: headers object', async () => {
    const fetch = fetchDouble({ id: 'r1' })
    await createResendSender('key', fetch as never)(payload, { event: 'live_class_reminder' })
    expect(JSON.parse(String(fetch.mock.calls[0][1].body)).headers).toEqual(headers)
  })

  it('Brevo: headers object beside the idempotency key', async () => {
    const fetch = fetchDouble({ messageId: 'b1' })
    await createBrevoSender('key', fetch as never)(payload, { event: 'live_class_reminder', idempotencyKey: 'k' })
    const body = JSON.parse(String(fetch.mock.calls[0][1].body))
    expect(body.headers).toMatchObject(headers)
    expect(body.headers.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.sender).toEqual({ email: 'noreply@mail.kanvise.com', name: 'Michael Chen via Kanvise' })
  })

  it('Mailjet: Headers on the message', async () => {
    const fetch = fetchDouble({ Messages: [{ Status: 'success', To: [{ MessageUUID: 'm1' }] }] })
    await createMailjetSender('key', 'secret', fetch as never)(payload, { event: 'live_class_reminder' })
    const body = JSON.parse(String(fetch.mock.calls[0][1].body))
    expect(body.Messages[0].Headers).toEqual(headers)
    expect(body.Messages[0].From).toEqual({ Email: 'noreply@mail.kanvise.com', Name: 'Michael Chen via Kanvise' })
  })

  it('essential emails send no extra headers', async () => {
    const fetch = fetchDouble({ id: 'r1' })
    const { headers: _ignored, ...plain } = payload
    await createResendSender('key', fetch as never)(plain, { event: 'class_cancellation' })
    expect(JSON.parse(String(fetch.mock.calls[0][1].body)).headers).toBeUndefined()
    const brevoFetch = fetchDouble({ messageId: 'b1' })
    await createBrevoSender('key', brevoFetch as never)(plain, { event: 'class_cancellation' })
    expect(JSON.parse(String(brevoFetch.mock.calls[0][1].body)).headers).toBeUndefined()
  })
})
