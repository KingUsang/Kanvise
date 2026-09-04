import { supabase } from '../lib/supabase'
import type { NotificationEvent } from '../notifications/types'

export type StoredSubscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  expiration_time: string | null
}

const db = supabase as any

export const pushRepository = {
  async upsertSubscription(input: { userId: string; schoolId: string; endpoint: string; p256dh: string; auth: string; expirationTime: string | null; userAgent: string | null }) {
    const { data, error } = await db.from('push_subscriptions').upsert({
      user_id: input.userId,
      school_id: input.schoolId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      expiration_time: input.expirationTime,
      user_agent: input.userAgent,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' }).select('id').single()
    if (error) throw error
    return data as { id: string }
  },

  async deleteSubscription(userId: string, endpoint: string) {
    const { error } = await db.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint)
    if (error) throw error
  },

  async deleteSubscriptionById(id: string) {
    const { error } = await db.from('push_subscriptions').delete().eq('id', id)
    if (error) throw error
  },

  async listSubscriptions(userId: string, schoolId: string): Promise<StoredSubscription[]> {
    const { data, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth, expiration_time')
      .eq('user_id', userId).eq('school_id', schoolId)
    if (error) throw error
    return (data || []) as StoredSubscription[]
  },

  async beginDelivery(input: { key: string; subscriptionId: string; userId: string; schoolId: string; event: NotificationEvent }) {
    const { error } = await db.from('push_deliveries').upsert({
      idempotency_key: input.key,
      subscription_id: input.subscriptionId,
      user_id: input.userId,
      school_id: input.schoolId,
      event_type: input.event,
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    if (error) throw error
    const { data, error: readError } = await db.from('push_deliveries')
      .select('status, attempt_count').eq('idempotency_key', input.key).single()
    if (readError) throw readError
    return data as { status: 'pending' | 'sent' | 'failed'; attempt_count: number }
  },

  async markAttempt(key: string, attemptCount: number) {
    const { error } = await db.from('push_deliveries').update({
      status: 'pending', attempt_count: attemptCount, last_error: null, updated_at: new Date().toISOString(),
    }).eq('idempotency_key', key)
    if (error) throw error
  },

  async markSent(key: string) {
    const now = new Date().toISOString()
    const { error } = await db.from('push_deliveries').update({ status: 'sent', sent_at: now, last_error: null, updated_at: now }).eq('idempotency_key', key)
    if (error) throw error
  },

  async markFailed(key: string, message: string) {
    const { error } = await db.from('push_deliveries').update({
      status: 'failed', last_error: message.slice(0, 500), updated_at: new Date().toISOString(),
    }).eq('idempotency_key', key)
    if (error) throw error
  },
}
