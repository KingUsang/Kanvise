import { describe, expect, it, vi } from 'vitest'
import { ensurePaymentConfirmationEmail, type PaymentDeliveryStore } from './ensure-payment-confirmation'

function fakeStore(): PaymentDeliveryStore & { record: any } {
  return {
    record: undefined,
    async createIfMissing(key) { this.record ||= { key, status: 'pending', provider_message_id: null, attempt_count: 0 } },
    async get() { return this.record },
    async markAttempt(_key, count) { this.record = { ...this.record, status: 'pending', attempt_count: count } },
    async markSent(_key, id) { this.record = { ...this.record, status: 'sent', provider_message_id: id } },
    async markFailed(_key, error) { this.record = { ...this.record, status: 'failed', error } },
  }
}

const input = {
  paymentId: 'payment-1', recipientEmail: 'student@example.com', firstName: 'Ada',
  schoolName: 'Bright Minds', targetName: 'WAEC Physics', amount: '₦25,000.00',
  paymentReference: 'PAY-1', paidAt: '2026-07-20T12:00:00Z', dashboardUrl: 'https://kanvise.com/dashboard',
}

describe('ensurePaymentConfirmationEmail', () => {
  it('sends one combined email across duplicate webhook processing', async () => {
    const store = fakeStore()
    const send = vi.fn(async () => ({ id: 'email-payment-1' }))

    await expect(ensurePaymentConfirmationEmail(input, { store, send })).resolves.toMatchObject({ sent: true, alreadySent: false })
    await expect(ensurePaymentConfirmationEmail(input, { store, send })).resolves.toEqual({ sent: true, id: 'email-payment-1', alreadySent: true })

    expect(send).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'payment_confirmed:payment-1', programmeName: 'WAEC Physics',
    }))
  })

  it('keeps a failed receipt retryable', async () => {
    const store = fakeStore()
    const send = vi.fn().mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce({ id: 'email-payment-2' })

    await expect(ensurePaymentConfirmationEmail(input, { store, send })).resolves.toMatchObject({ sent: false })
    await expect(ensurePaymentConfirmationEmail(input, { store, send })).resolves.toMatchObject({ sent: true })
    expect(send).toHaveBeenCalledTimes(2)
  })
})

