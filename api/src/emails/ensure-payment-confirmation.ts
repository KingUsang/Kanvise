import { supabase } from '../lib/supabase'
import { sendPaymentConfirmation } from './send-payment-confirmation'

type PaymentDelivery = { status: 'pending' | 'sent' | 'failed'; provider_message_id: string | null; attempt_count: number }

export type PaymentDeliveryStore = {
  createIfMissing(key: string, recipient: string): Promise<void>
  get(key: string): Promise<PaymentDelivery>
  markAttempt(key: string, count: number): Promise<void>
  markSent(key: string, id: string | null): Promise<void>
  markFailed(key: string, error: string): Promise<void>
}

const store: PaymentDeliveryStore = {
  async createIfMissing(key, recipient) {
    const { error } = await supabase.from('email_deliveries').upsert({
      idempotency_key: key, event_type: 'payment_confirmed', recipient_email: recipient,
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    if (error) throw error
  },
  async get(key) {
    const { data, error } = await supabase.from('email_deliveries')
      .select('status, provider_message_id, attempt_count').eq('idempotency_key', key).single()
    if (error || !data) throw error || new Error('Payment email delivery record not found')
    return data as PaymentDelivery
  },
  async markAttempt(key, count) {
    const { error } = await supabase.from('email_deliveries').update({
      status: 'pending', attempt_count: count, updated_at: new Date().toISOString(),
    }).eq('idempotency_key', key)
    if (error) throw error
  },
  async markSent(key, id) {
    const { error } = await supabase.from('email_deliveries').update({
      status: 'sent', provider_message_id: id, sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString(),
    }).eq('idempotency_key', key)
    if (error) throw error
  },
  async markFailed(key, message) {
    const { error } = await supabase.from('email_deliveries').update({
      status: 'failed', last_error: message.slice(0, 500), updated_at: new Date().toISOString(),
    }).eq('idempotency_key', key)
    if (error) throw error
  },
}

export type PaymentEmailDetails = {
  paymentId: string
  recipientEmail: string
  firstName: string
  schoolName: string
  targetName: string
  amount: string
  paymentReference: string
  paidAt: string
  dashboardUrl: string
}

export async function ensurePaymentConfirmationEmail(
  input: PaymentEmailDetails,
  dependencies: { store: PaymentDeliveryStore; send: typeof sendPaymentConfirmation } = { store, send: sendPaymentConfirmation },
) {
  const idempotencyKey = `payment_confirmed:${input.paymentId}`
  await dependencies.store.createIfMissing(idempotencyKey, input.recipientEmail)
  const record = await dependencies.store.get(idempotencyKey)
  if (record.status === 'sent') return { sent: true, id: record.provider_message_id, alreadySent: true }

  await dependencies.store.markAttempt(idempotencyKey, record.attempt_count + 1)

  try {
    const delivery = await dependencies.send({
      to: input.recipientEmail,
      firstName: input.firstName,
      schoolName: input.schoolName,
      programmeName: input.targetName,
      amount: input.amount,
      paymentReference: input.paymentReference,
      paidAt: input.paidAt,
      dashboardUrl: input.dashboardUrl,
      idempotencyKey,
    })
    await dependencies.store.markSent(idempotencyKey, delivery.id)
    return { sent: true, id: delivery.id, alreadySent: false }
  } catch (error) {
    const safeError = error instanceof Error ? error.message : 'Unknown email delivery error'
    await dependencies.store.markFailed(idempotencyKey, safeError)
    console.error('email.delivery_failed', { event: 'payment_confirmed', idempotencyKey, error: safeError })
    return { sent: false, id: null, alreadySent: false }
  }
}
