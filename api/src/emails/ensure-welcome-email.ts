import { supabase } from '../lib/supabase'
import { sendWelcomeEmail } from './send-welcome'
import { retryWrite } from '../lib/retry-write'

type Delivery = {
  idempotency_key: string
  status: 'pending' | 'sent' | 'failed'
  provider_message_id: string | null
  attempt_count: number
}

export type WelcomeDeliveryStore = {
  createIfMissing(input: { idempotencyKey: string; recipientEmail: string }): Promise<void>
  get(idempotencyKey: string): Promise<Delivery>
  claim(idempotencyKey: string): Promise<boolean>
  markSent(idempotencyKey: string, providerMessageId: string | null): Promise<void>
  markFailed(idempotencyKey: string, safeError: string): Promise<void>
}

const deliveryStore: WelcomeDeliveryStore = {
  async createIfMissing({ idempotencyKey, recipientEmail }) {
    const { error } = await supabase.from('email_deliveries').upsert({
      idempotency_key: idempotencyKey,
      event_type: 'welcome',
      recipient_email: recipientEmail,
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    if (error) throw error
  },
  async get(idempotencyKey) {
    const { data, error } = await supabase.from('email_deliveries')
      .select('idempotency_key, status, provider_message_id, attempt_count')
      .eq('idempotency_key', idempotencyKey)
      .single()
    if (error || !data) throw error || new Error('Email delivery record not found')
    return data as Delivery
  },
  async claim(idempotencyKey) {
    const { data, error } = await (supabase as any).rpc('claim_email_delivery', { p_key: idempotencyKey, p_lease_seconds: 300 })
    if (error) throw error
    return Boolean(data)
  },
  async markSent(idempotencyKey, providerMessageId) {
    const { error } = await supabase.from('email_deliveries').update({
      status: 'sent',
      provider_message_id: providerMessageId,
      sent_at: new Date().toISOString(),
      last_error: null,
      claimed_until: null,
      updated_at: new Date().toISOString(),
    }).eq('idempotency_key', idempotencyKey)
    if (error) throw error
  },
  async markFailed(idempotencyKey, safeError) {
    const { error } = await supabase.from('email_deliveries').update({
      status: 'failed',
      last_error: safeError.slice(0, 500),
      claimed_until: null,
      updated_at: new Date().toISOString(),
    }).eq('idempotency_key', idempotencyKey)
    if (error) throw error
  },
}

type EnsureWelcomeInput = {
  profileId: string
  recipientEmail: string
  firstName: string
  dashboardUrl: string
  role: string
}

type WelcomeDependencies = {
  store: WelcomeDeliveryStore
  send: typeof sendWelcomeEmail
}

export async function ensureWelcomeEmail(
  input: EnsureWelcomeInput,
  dependencies: WelcomeDependencies = { store: deliveryStore, send: sendWelcomeEmail },
) {
  const idempotencyKey = `welcome:${input.profileId}`
  await dependencies.store.createIfMissing({ idempotencyKey, recipientEmail: input.recipientEmail })
  const existing = await dependencies.store.get(idempotencyKey)

  if (existing.status === 'sent') {
    return { sent: true, id: existing.provider_message_id, alreadySent: true }
  }

  let providerAccepted = false
  try {
    // Atomic claim so two workers cannot both send the welcome email.
    if (!await dependencies.store.claim(idempotencyKey)) return { sent: false, id: null, alreadySent: false }
    const result = await dependencies.send({
      to: input.recipientEmail,
      firstName: input.firstName,
      dashboardUrl: input.dashboardUrl,
      role: input.role,
      idempotencyKey,
    })
    providerAccepted = true
    // The email is delivered. A failing ledger write must not mark it failed.
    const recorded = await retryWrite(() => dependencies.store.markSent(idempotencyKey, result.id))
    if (!recorded) console.error('email.sent_state_write_failed', { event: 'welcome', idempotencyKey })
    return { sent: true, id: result.id, alreadySent: false }
  } catch (error) {
    const safeError = error instanceof Error ? error.message : 'Unknown email delivery error'
    if (!providerAccepted) await dependencies.store.markFailed(idempotencyKey, safeError)
    console.error('email.delivery_failed', { event: 'welcome', idempotencyKey, error: safeError })
    return { sent: false, id: null, alreadySent: false }
  }
}
