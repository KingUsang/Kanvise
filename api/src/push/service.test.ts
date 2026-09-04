import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  listSubscriptions: vi.fn(),
  beginDelivery: vi.fn(),
  markAttempt: vi.fn(),
  markSent: vi.fn(),
  markFailed: vi.fn(),
  deleteSubscriptionById: vi.fn(),
}))

vi.mock('web-push', () => ({ default: { sendNotification: mocks.sendNotification } }))
vi.mock('./config', () => ({ configureWebPush: () => ({ enabled: true, publicKey: 'public' }) }))
vi.mock('./repository', () => ({ pushRepository: mocks }))

import { sendWebPushNotification } from './service'

const input = {
  userId: 'student-1', schoolId: 'school-1', event: 'mock_published' as const, relatedEntityId: 'mock-1',
  payload: { title: 'New mock available', body: 'Physics is available.', url: '/dashboard/student/mocks/mock-1', tag: 'mock_published:mock-1' },
}

describe('sendWebPushNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listSubscriptions.mockResolvedValue([{ id: 'sub-1', endpoint: 'https://push.test/1', p256dh: 'key', auth: 'auth', expiration_time: null }])
    mocks.beginDelivery.mockResolvedValue({ status: 'pending', attempt_count: 0 })
    mocks.sendNotification.mockResolvedValue({ statusCode: 201 })
  })

  it('sends and records one idempotent delivery per subscription', async () => {
    await expect(sendWebPushNotification(input)).resolves.toEqual({ sent: 1, alreadySent: 0, skipped: 0, failures: [] })
    expect(mocks.beginDelivery).toHaveBeenCalledWith(expect.objectContaining({
      key: 'mock_published:mock-1:student-1:sub-1', subscriptionId: 'sub-1', schoolId: 'school-1',
    }))
    expect(mocks.sendNotification).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'https://push.test/1' }), JSON.stringify(input.payload), { TTL: 86400 })
    expect(mocks.markSent).toHaveBeenCalledOnce()
  })

  it('does not resend an already-sent delivery', async () => {
    mocks.beginDelivery.mockResolvedValue({ status: 'sent', attempt_count: 1 })
    await expect(sendWebPushNotification(input)).resolves.toMatchObject({ sent: 0, alreadySent: 1 })
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('delivers independently to multiple subscriptions for the same user', async () => {
    mocks.listSubscriptions.mockResolvedValue([
      { id: 'sub-1', endpoint: 'https://push.test/1', p256dh: 'key-1', auth: 'auth-1', expiration_time: null },
      { id: 'sub-2', endpoint: 'https://push.test/2', p256dh: 'key-2', auth: 'auth-2', expiration_time: null },
    ])
    await expect(sendWebPushNotification(input)).resolves.toMatchObject({ sent: 2 })
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2)
    expect(mocks.markSent).toHaveBeenCalledTimes(2)
  })

  it.each([404, 410])('removes a permanently invalid subscription returning %s', async statusCode => {
    mocks.sendNotification.mockRejectedValue(Object.assign(new Error('gone'), { statusCode }))
    await expect(sendWebPushNotification(input)).resolves.toMatchObject({ skipped: 1, failures: [] })
    expect(mocks.deleteSubscriptionById).toHaveBeenCalledWith('sub-1')
  })

  it('records transient provider failures without throwing', async () => {
    mocks.sendNotification.mockRejectedValue(Object.assign(new Error('unavailable'), { statusCode: 503 }))
    await expect(sendWebPushNotification(input)).resolves.toMatchObject({ sent: 0, failures: [{ error: 'unavailable' }] })
    expect(mocks.markFailed).toHaveBeenCalledWith(expect.any(String), 'unavailable')
  })
})
