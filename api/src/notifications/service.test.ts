import { describe, expect, it, vi } from 'vitest'
import type { NotificationRepository } from './repository'
import { deliverNotification } from './service'
import type { NotificationRecipient } from './types'

function fakeRepository(recipients: NotificationRecipient[]): NotificationRepository & {
  notifications: string[]
  deliveries: Map<string, { status: 'pending' | 'sent' | 'failed'; provider_message_id: string | null; attempt_count: number }>
} {
  return {
    notifications: [],
    deliveries: new Map(),
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
    async markDeliveryAttempt(key, attemptCount) {
      this.deliveries.set(key, { ...this.deliveries.get(key)!, status: 'pending', attempt_count: attemptCount })
    },
    async markDeliverySent(key, providerMessageId) {
      this.deliveries.set(key, { ...this.deliveries.get(key)!, status: 'sent', provider_message_id: providerMessageId })
    },
    async markDeliveryFailed(key) {
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
})
