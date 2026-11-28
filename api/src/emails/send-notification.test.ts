import { beforeEach, describe, expect, it } from 'vitest'
import { sendNotificationEmail } from './send-notification'

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_test'
  process.env.EMAIL_FROM = 'Kanvise <noreply@kanvise.com>'
  process.env.FRONTEND_URL = 'https://kanvise.com'
})

describe('sendNotificationEmail', () => {
  it('normalizes provider failures with the event name', async () => {
    const transport = {
      async send() { return { data: null, error: { message: 'rate limited' } } },
    }
    await expect(sendNotificationEmail('mock_published', {
      to: 'student@example.com',
      idempotencyKey: 'mock_published:mock-1:student-1',
      firstName: 'Ada',
      mockTitle: 'Physics Mock',
      courseName: 'Physics',
      mockUrl: 'https://kanvise.com/mocks/1',
      unsubscribe: { pageUrl: 'https://kanvise.com/unsubscribe?token=t', oneClickUrl: null },
    }, transport)).rejects.toThrow('Email provider could not deliver mock_published: rate limited')
  })

  it('sends from "{name} via Kanvise" with the one-click headers (NTF-04)', async () => {
    const sent: Array<Record<string, unknown>> = []
    const transport = {
      async send(payload: Record<string, unknown>) { sent.push(payload); return { data: { id: 'msg-1' }, error: null } },
    }
    await sendNotificationEmail('mock_published', {
      to: 'student@example.com',
      idempotencyKey: 'mock_published:mock-1:student-1',
      firstName: 'Ada',
      mockTitle: 'Physics Mock',
      courseName: 'Physics',
      mockUrl: 'https://kanvise.com/mocks/1',
      senderName: 'Michael Chen',
      unsubscribe: { pageUrl: 'https://kanvise.com/unsubscribe?token=t', oneClickUrl: 'https://api.kanvise.com/unsubscribe/one-click?token=t' },
    }, transport as never)
    expect(sent[0].from).toBe('"Michael Chen via Kanvise" <noreply@kanvise.com>')
    expect(sent[0].headers).toEqual({
      'List-Unsubscribe': '<https://api.kanvise.com/unsubscribe/one-click?token=t>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
  })

  it('keeps the configured sender when no name is given', async () => {
    const sent: Array<Record<string, unknown>> = []
    const transport = { async send(payload: Record<string, unknown>) { sent.push(payload); return { data: { id: 'm' }, error: null } } }
    await sendNotificationEmail('class_cancellation', {
      to: 'student@example.com', idempotencyKey: 'k', firstName: 'Ada', classTitle: 'Physics',
      scheduledAt: '2026-07-20T15:00:00Z', schoolName: 'Bright Minds', dashboardUrl: 'https://kanvise.com/dashboard',
    }, transport as never)
    expect(sent[0].from).toBe('Kanvise <noreply@kanvise.com>')
    expect(sent[0].headers).toBeUndefined()
  })
})
