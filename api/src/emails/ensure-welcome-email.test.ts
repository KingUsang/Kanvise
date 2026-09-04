import { describe, expect, it, vi } from 'vitest'
import { ensureWelcomeEmail, type WelcomeDeliveryStore } from './ensure-welcome-email'

function createStore(): WelcomeDeliveryStore & { record?: any } {
  return {
    record: undefined,
    async createIfMissing({ idempotencyKey }) {
      this.record ||= { idempotency_key: idempotencyKey, status: 'pending', provider_message_id: null, attempt_count: 0 }
    },
    async get() { return this.record },
    async markAttempt(_key, attemptCount) { this.record = { ...this.record, status: 'pending', attempt_count: attemptCount } },
    async markSent(_key, id) { this.record = { ...this.record, status: 'sent', provider_message_id: id } },
    async markFailed() { this.record = { ...this.record, status: 'failed' } },
  }
}

const input = {
  profileId: 'profile-123',
  recipientEmail: 'ada@example.com',
  firstName: 'Ada',
  dashboardUrl: 'https://kanvise.com/dashboard',
}

describe('ensureWelcomeEmail', () => {
  it('sends once and returns persisted delivery on a retry', async () => {
    const store = createStore()
    const send = vi.fn(async () => ({ id: 'email-123' }))

    await expect(ensureWelcomeEmail(input, { store, send })).resolves.toEqual({ sent: true, id: 'email-123', alreadySent: false })
    await expect(ensureWelcomeEmail(input, { store, send })).resolves.toEqual({ sent: true, id: 'email-123', alreadySent: true })

    expect(send).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'welcome:profile-123' }))
  })

  it('records a failure and retries it with the same provider idempotency key', async () => {
    const store = createStore()
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('temporary provider failure'))
      .mockResolvedValueOnce({ id: 'email-456' })

    await expect(ensureWelcomeEmail(input, { store, send })).resolves.toEqual({ sent: false, id: null, alreadySent: false })
    await expect(ensureWelcomeEmail(input, { store, send })).resolves.toEqual({ sent: true, id: 'email-456', alreadySent: false })

    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][0].idempotencyKey).toBe(send.mock.calls[1][0].idempotencyKey)
    expect(store.record.attempt_count).toBe(2)
  })
})

