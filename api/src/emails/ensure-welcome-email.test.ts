import { describe, expect, it, vi } from 'vitest'
import { ensureWelcomeEmail, type WelcomeDeliveryStore } from './ensure-welcome-email'

function createStore(): WelcomeDeliveryStore & { record?: any } {
  return {
    record: undefined,
    async createIfMissing({ idempotencyKey }) {
      this.record ||= { idempotency_key: idempotencyKey, status: 'pending', provider_message_id: null, attempt_count: 0 }
    },
    async get() { return this.record },
    async claim() {
      if (this.record.status === 'sent' || this.record.claimed) return false
      this.record = { ...this.record, status: 'pending', claimed: true, attempt_count: this.record.attempt_count + 1 }
      return true
    },
    async markSent(_key, id) { this.record = { ...this.record, status: 'sent', claimed: false, provider_message_id: id } },
    async markFailed() { this.record = { ...this.record, status: 'failed', claimed: false } },
  }
}

const input = {
  profileId: 'profile-123',
  recipientEmail: 'ada@example.com',
  firstName: 'Ada',
  dashboardUrl: 'https://kanvise.com/dashboard',
  role: 'student',
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

  it('lets only one concurrent worker send', async () => {
    const store = createStore()
    const send = vi.fn(async () => ({ id: 'email-789' }))
    await Promise.all([ensureWelcomeEmail(input, { store, send }), ensureWelcomeEmail(input, { store, send })])
    expect(send).toHaveBeenCalledOnce()
  })

  it('does not mark a delivered email failed when the sent-state write fails', async () => {
    const store = createStore()
    const markFailed = vi.spyOn(store, 'markFailed')
    vi.spyOn(store, 'markSent').mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const send = vi.fn(async () => ({ id: 'email-1' }))
    await expect(ensureWelcomeEmail(input, { store, send })).resolves.toEqual({ sent: true, id: 'email-1', alreadySent: false })
    expect(markFailed).not.toHaveBeenCalled()
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

