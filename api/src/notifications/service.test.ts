import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationRepository, PreferenceRecord } from './repository'
import { deliverNotification } from './service'

// No database in unit tests: the token issuer is a double.
vi.mock('./unsubscribe', () => ({ issueUnsubscribeToken: vi.fn(async () => 'T'.repeat(43)) }))

beforeEach(() => {
  process.env.FRONTEND_URL = 'https://kanvise.com'
  delete process.env.API_PUBLIC_URL
})
import type { NotificationRecipient } from './types'

function fakeRepository(recipients: NotificationRecipient[]): NotificationRepository & {
  notifications: string[]
  deliveries: Map<string, { status: 'pending' | 'sent' | 'failed'; provider_message_id: string | null; attempt_count: number }>
  claimed: Set<string>
} {
  return {
    notifications: [],
    deliveries: new Map(),
    claimed: new Set(),
    async resolveRecipients() { return recipients },
    async createInApp(input) {
      const key = `${input.event}:${input.relatedEntityId}:${input.recipientId}`
      if (this.notifications.includes(key)) return false
      this.notifications.push(key)
      return true
    },
    async createDelivery(key) {
      if (!this.deliveries.has(key)) this.deliveries.set(key, { status: 'pending', provider_message_id: null, attempt_count: 0 })
    },
    async getDelivery(key) { return this.deliveries.get(key)! },
    async claimDelivery(key) {
      const current = this.deliveries.get(key)!
      if (current.status === 'sent' || this.claimed.has(key)) return false
      this.claimed.add(key)
      this.deliveries.set(key, { ...current, status: 'pending', attempt_count: current.attempt_count + 1 })
      return true
    },
    async markDeliverySent(key, providerMessageId) {
      this.claimed.delete(key)
      this.deliveries.set(key, { ...this.deliveries.get(key)!, status: 'sent', provider_message_id: providerMessageId })
    },
    async markDeliveryFailed(key) {
      this.claimed.delete(key)
      const current = this.deliveries.get(key)
      if (current) this.deliveries.set(key, { ...current, status: 'failed' })
    },
  }
}

const request = {
  schoolId: 'school-1',
  event: 'live_class_reminder' as const,
  recipients: { enrolment: { type: 'course' as const, id: 'course-1' } },
  title: 'Class starts soon',
  body: 'Physics starts in 15 minutes.',
  relatedEntityType: 'live_class',
  relatedEntityId: 'class-1',
  push: { body: 'Physics starts soon.', url: '/class/class-1' },
  emailInput: (recipient: NotificationRecipient) => ({
    firstName: recipient.firstName,
    classTitle: 'Physics revision',
    courseName: 'Physics',
    startsAt: '2026-07-20T15:00:00Z',
    joinUrl: 'https://kanvise.com/class/class-1',
  }),
}

const quietLogger = { info: vi.fn(), error: vi.fn() }

describe('deliverNotification', () => {
  it('creates in-app notifications and sends idempotent email per recipient', async () => {
    const repository = fakeRepository([
      { id: 'student-1', schoolId: 'school-1', email: 'one@example.com', firstName: 'Ada' },
      { id: 'student-2', schoolId: 'school-1', email: null, firstName: 'Tobi' },
    ])
    const sendEmail = vi.fn(async () => ({ id: 'email-1' }))

    const first = await deliverNotification(request, { repository, sendEmail, logger: quietLogger })
    const retry = await deliverNotification(request, { repository, sendEmail, logger: quietLogger })

    expect(first).toMatchObject({ recipients: 2, inAppCreated: 2, emailsSent: 1, skippedNoEmail: 1 })
    expect(retry).toMatchObject({ recipients: 2, inAppCreated: 0, emailsAlreadySent: 1, skippedNoEmail: 1 })
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(sendEmail).toHaveBeenCalledWith('live_class_reminder', expect.objectContaining({
      to: 'one@example.com', idempotencyKey: 'live_class_reminder:class-1:student-1',
    }))
  })

  it('rejects cross-tenant recipients before creating either channel', async () => {
    const repository = fakeRepository([
      { id: 'student-other', schoolId: 'school-2', email: 'other@example.com', firstName: 'Efe' },
    ])
    const sendEmail = vi.fn(async () => ({ id: 'should-not-send' }))

    const result = await deliverNotification(request, { repository, sendEmail, logger: quietLogger })

    expect(result.recipients).toBe(0)
    expect(result.failures).toEqual([expect.objectContaining({ recipientId: 'student-other', channel: 'recipient' })])
    expect(repository.notifications).toEqual([])
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('continues after a per-recipient email failure and leaves it retryable', async () => {
    const repository = fakeRepository([
      { id: 'student-1', schoolId: 'school-1', email: 'one@example.com', firstName: 'Ada' },
      { id: 'student-2', schoolId: 'school-1', email: 'two@example.com', firstName: 'Tobi' },
    ])
    const sendEmail = vi.fn(async (_event, input: any) => {
      if (input.to === 'one@example.com') throw new Error('provider unavailable')
      return { id: 'email-2' }
    })

    const result = await deliverNotification(request, { repository, sendEmail, logger: quietLogger })

    expect(result).toMatchObject({ recipients: 2, inAppCreated: 2, emailsSent: 1 })
    expect(result.failures).toEqual([expect.objectContaining({ recipientId: 'student-1', channel: 'email' })])
    expect(repository.deliveries.get('live_class_reminder:class-1:student-1')?.status).toBe('failed')
  })

  it('caps concurrent recipient processing at the requested batch size', async () => {
    const recipients = Array.from({ length: 5 }, (_, index) => ({
      id: `student-${index}`, schoolId: 'school-1', email: `${index}@example.com`, firstName: `Student ${index}`,
    }))
    const repository = fakeRepository(recipients)
    let active = 0
    let maximum = 0
    const sendEmail = vi.fn(async () => {
      active += 1
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return { id: 'email' }
    })

    await deliverNotification({ ...request, batchSize: 2 }, { repository, sendEmail, logger: quietLogger })
    expect(maximum).toBeLessThanOrEqual(2)
  })

  it('counts push delivery independently from email and in-app channels', async () => {
    const repository = fakeRepository([{ id: 'student-1', schoolId: 'school-1', email: null, firstName: 'Ada' }])
    const sendPush = vi.fn(async () => ({ sent: 1, alreadySent: 0, skipped: 0, failures: [] }))
    const result = await deliverNotification(request, { repository, sendEmail: vi.fn(), sendPush, logger: quietLogger })
    expect(result).toMatchObject({ inAppCreated: 1, pushSent: 1, skippedNoEmail: 1 })
    expect(sendPush).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1', schoolId: 'school-1', payload: expect.objectContaining({ url: '/class/class-1' }),
    }))
  })

  it('continues email and in-app delivery when push fails', async () => {
    const repository = fakeRepository([{ id: 'student-1', schoolId: 'school-1', email: 'ada@example.com', firstName: 'Ada' }])
    const sendEmail = vi.fn(async () => ({ id: 'email-1' }))
    const sendPush = vi.fn(async () => { throw new Error('push unavailable') })
    const result = await deliverNotification(request, { repository, sendEmail, sendPush, logger: quietLogger })
    expect(result).toMatchObject({ inAppCreated: 1, emailsSent: 1, pushSent: 0 })
    expect(result.failures).toContainEqual(expect.objectContaining({ channel: 'push', error: 'push unavailable' }))
  })

  it('records and retries each channel independently (DEV-NTF-004)', async () => {
    const state = new Map<string, string>()
    const repository = {
      ...fakeRepository([{ id: 'student-1', schoolId: 'school-1', email: 'one@example.com', firstName: 'Ada' }]),
      async channelAlreadySent(key: any) { return state.get(key.channel) === 'sent' },
      async recordChannel(key: any, status: string) { state.set(key.channel, status) },
    }
    const sendEmail = vi.fn(async () => ({ id: 'email-1' }))
    const sendPush = vi.fn()
      .mockResolvedValueOnce({ sent: 0, alreadySent: 0, skipped: 0, failures: [{ error: 'push service down' }] })
      .mockResolvedValue({ sent: 1, alreadySent: 0, skipped: 0, failures: [] })

    const first = await deliverNotification(request, { repository, sendEmail, sendPush, logger: quietLogger })
    expect(first.failures).toEqual([expect.objectContaining({ channel: 'push' })])
    expect(Object.fromEntries(state)).toEqual({ in_app: 'sent', push: 'failed', email: 'sent' })

    const retry = await deliverNotification(request, { repository, sendEmail, sendPush, logger: quietLogger })
    expect(retry.failures).toEqual([])
    expect(Object.fromEntries(state)).toEqual({ in_app: 'sent', push: 'sent', email: 'sent' })
    expect(sendPush).toHaveBeenCalledTimes(2)
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(repository.notifications).toHaveLength(1)
  })

  it('does not let a failing state write break delivery', async () => {
    const repository = {
      ...fakeRepository([{ id: 'student-1', schoolId: 'school-1', email: null, firstName: 'Ada' }]),
      async recordChannel() { throw new Error('ledger down') },
    }
    const sendPush = vi.fn(async () => ({ sent: 1, alreadySent: 0, skipped: 0, failures: [] }))
    const result = await deliverNotification(request, { repository, sendEmail: vi.fn(), sendPush, logger: quietLogger })
    expect(result.failures).toEqual([])
    expect(result.inAppCreated).toBe(1)
  })

  it('delivers a recap in-app and by push without any email template (DEV-NTF-003)', async () => {
    const repository = fakeRepository([{ id: 'student-1', schoolId: 'school-1', email: 'one@example.com', firstName: 'Ada' }])
    const sendEmail = vi.fn()
    const sendPush = vi.fn(async () => ({ sent: 1, alreadySent: 0, skipped: 0, failures: [] }))
    const { emailInput: _unused, ...base } = request
    const result = await deliverNotification({ ...base, event: 'class_recap_ready' as const }, { repository, sendEmail, sendPush, logger: quietLogger })
    expect(result).toMatchObject({ inAppCreated: 1, pushSent: 1, emailsSent: 0, skippedNoEmail: 0 })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  describe('switches (12 CFG-N, 09 SA-10)', () => {
    const student = { id: 'student-1', schoolId: 'school-1', email: 'one@example.com', firstName: 'Ada' }
    const withPreferences = (rows: PreferenceRecord[] | Error) => {
      const state = new Map<string, { status: string; error?: string }>()
      return {
        state,
        repository: {
          ...fakeRepository([student]),
          async getPreferences() { if (rows instanceof Error) throw rows; return rows },
          async getAccountName() { return 'Science Students Academy' },
          async recordChannel(key: any, status: string, error?: string) { state.set(key.channel, { status, error }) },
        },
      }
    }
    const push = () => vi.fn(async () => ({ sent: 1, alreadySent: 0, skipped: 0, failures: [] }))

    it('skips a switched-off email and records why', async () => {
      const { repository, state } = withPreferences([{ personId: 'student-1', rowKey: 'lesson_reminders', pushOn: null, emailOn: false }])
      const sendEmail = vi.fn(async () => ({ id: 'email-1' }))
      const sendPush = push()
      const result = await deliverNotification(request, { repository, sendEmail, sendPush, logger: quietLogger })
      expect(sendEmail).not.toHaveBeenCalled()
      expect(sendPush).toHaveBeenCalledOnce()
      expect(result.switchedOff).toBe(1)
      expect(state.get('email')).toEqual({ status: 'skipped', error: 'Switched off' })
    })

    it('skips a switched-off push and still emails', async () => {
      const { repository, state } = withPreferences([{ personId: 'student-1', rowKey: 'student_push', pushOn: false, emailOn: null }])
      const sendEmail = vi.fn(async () => ({ id: 'email-1' }))
      const sendPush = push()
      await deliverNotification(request, { repository, sendEmail, sendPush, logger: quietLogger })
      expect(sendPush).not.toHaveBeenCalled()
      expect(sendEmail).toHaveBeenCalledOnce()
      expect(state.get('push')).toEqual({ status: 'skipped', error: 'Switched off' })
    })

    it('never skips an essential event', async () => {
      const { repository } = withPreferences([
        { personId: 'student-1', rowKey: 'student_push', pushOn: false, emailOn: false },
        { personId: 'student-1', rowKey: 'lesson_reminders', pushOn: false, emailOn: false },
      ])
      const sendEmail = vi.fn(async () => ({ id: 'email-1' }))
      const sendPush = push()
      const cancelled = {
        ...request,
        event: 'class_cancelled' as const,
        emailInput: () => ({
          firstName: 'Ada', classTitle: 'Physics', scheduledAt: '2026-07-20T15:00:00Z',
          schoolName: 'Bright Minds', dashboardUrl: 'https://kanvise.com/dashboard',
        }),
      }
      const result = await deliverNotification(cancelled, { repository, sendEmail, sendPush, logger: quietLogger })
      expect(sendPush).toHaveBeenCalledOnce()
      expect(sendEmail).toHaveBeenCalledWith('class_cancellation', expect.not.objectContaining({ unsubscribe: expect.anything() }))
      expect(result.switchedOff).toBe(0)
    })

    it('sends with the defaults and logs when the switches cannot be read', async () => {
      const { repository } = withPreferences(new Error('database unavailable'))
      const sendEmail = vi.fn(async () => ({ id: 'email-1' }))
      const sendPush = push()
      const logger = { info: vi.fn(), error: vi.fn() }
      await deliverNotification(request, { repository, sendEmail, sendPush, logger })
      expect(sendEmail).toHaveBeenCalledOnce()
      expect(sendPush).toHaveBeenCalledOnce()
      expect(logger.error).toHaveBeenCalledWith('notification.preferences_read_failed', expect.objectContaining({ error: 'database unavailable' }))
    })

    it('gives a switchable email its unsubscribe link, the account as sender and the account timezone', async () => {
      const { repository } = withPreferences([])
      const sendEmail = vi.fn(async () => ({ id: 'email-1' }))
      await deliverNotification(request, { repository, sendEmail, sendPush: push(), logger: quietLogger, resolveTimeZone: async () => 'Africa/Nairobi' })
      expect(sendEmail).toHaveBeenCalledWith('live_class_reminder', expect.objectContaining({
        senderName: 'Science Students Academy',
        timeZone: 'Africa/Nairobi',
        unsubscribe: { pageUrl: `https://kanvise.com/unsubscribe?token=${'T'.repeat(43)}`, oneClickUrl: null },
      }))
    })

    it("uses the request's sender name before the account name", async () => {
      const { repository } = withPreferences([])
      const sendEmail = vi.fn(async () => ({ id: 'email-1' }))
      await deliverNotification({ ...request, senderName: 'Michael Chen' }, { repository, sendEmail, sendPush: push(), logger: quietLogger })
      expect(sendEmail).toHaveBeenCalledWith('live_class_reminder', expect.objectContaining({ senderName: 'Michael Chen' }))
    })
  })
})
