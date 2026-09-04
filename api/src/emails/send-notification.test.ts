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
    }, transport)).rejects.toThrow('Resend could not deliver mock_published: rate limited')
  })
})
