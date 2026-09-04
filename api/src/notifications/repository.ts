import { supabase } from '../lib/supabase'
import type { NotificationEvent, NotificationRecipient, RecipientSelector } from './types'

export type DeliveryRecord = {
  status: 'pending' | 'sent' | 'failed'
  provider_message_id: string | null
  attempt_count: number
}

export type NotificationRepository = {
  resolveRecipients(schoolId: string, selector: RecipientSelector): Promise<NotificationRecipient[]>
  createInApp(input: {
    schoolId: string
    recipientId: string
    event: NotificationEvent
    title: string
    body: string
    relatedEntityType: string
    relatedEntityId: string
  }): Promise<boolean>
  createDelivery(key: string, event: NotificationEvent, recipientEmail: string): Promise<void>
  getDelivery(key: string): Promise<DeliveryRecord>
  markDeliveryAttempt(key: string, attemptCount: number): Promise<void>
  markDeliverySent(key: string, providerMessageId: string | null): Promise<void>
  markDeliveryFailed(key: string, error: string): Promise<void>
}

function uniqueRecipients(rows: NotificationRecipient[]): NotificationRecipient[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()]
}

export const notificationRepository: NotificationRepository = {
  async resolveRecipients(schoolId, selector) {
    let recipientIds: string[]

    if ('recipientIds' in selector) {
      recipientIds = [...new Set(selector.recipientIds)]
    } else if ('school' in selector) {
      const { data, error } = await supabase.from('user_profiles').select('id')
        .eq('school_id', schoolId).eq('role', 'student').eq('is_active', true)
      if (error) throw error
      recipientIds = (data || []).map((row) => row.id as string)
    } else if (!selector.enrolment.id) {
      return []
    } else {
      const column = `${selector.enrolment.type}_id`
      const { data, error } = await supabase.from('enrolments')
        .select('student_id')
        .eq('school_id', schoolId)
        .eq(column, selector.enrolment.id)
      if (error) throw error
      recipientIds = [...new Set((data || []).map((row) => row.student_id as string))]
    }

    if (recipientIds.length === 0) return []
    const recipients: NotificationRecipient[] = []
    for (let offset = 0; offset < recipientIds.length; offset += 100) {
      const { data, error } = await supabase.from('user_profiles')
        .select('id, school_id, email, first_name')
        .eq('school_id', schoolId)
        .in('id', recipientIds.slice(offset, offset + 100))
      if (error) throw error
      recipients.push(...(data || []).map((row) => ({
        id: row.id as string,
        schoolId: row.school_id as string,
        email: row.email as string | null,
        firstName: row.first_name as string,
      })))
    }
    return uniqueRecipients(recipients)
  },

  async createInApp(input) {
    const { data, error } = await supabase.from('notifications').upsert({
      school_id: input.schoolId,
      user_id: input.recipientId,
      type: input.event,
      title: input.title,
      body: input.body,
      related_entity_type: input.relatedEntityType,
      related_entity_id: input.relatedEntityId,
    }, {
      onConflict: 'user_id,type,related_entity_type,related_entity_id',
      ignoreDuplicates: true,
    }).select('id')
    if (error) throw error
    return Boolean(data?.length)
  },

  async createDelivery(key, event, recipientEmail) {
    const { error } = await supabase.from('email_deliveries').upsert({
      idempotency_key: key,
      event_type: event,
      recipient_email: recipientEmail,
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    if (error) throw error
  },

  async getDelivery(key) {
    const { data, error } = await supabase.from('email_deliveries')
      .select('status, provider_message_id, attempt_count')
      .eq('idempotency_key', key)
      .single()
    if (error || !data) throw error || new Error('Email delivery record not found')
    return data as DeliveryRecord
  },

  async markDeliveryAttempt(key, attemptCount) {
    const { error } = await supabase.from('email_deliveries').update({
      status: 'pending', attempt_count: attemptCount, updated_at: new Date().toISOString(),
    }).eq('idempotency_key', key)
    if (error) throw error
  },

  async markDeliverySent(key, providerMessageId) {
    const { error } = await supabase.from('email_deliveries').update({
      status: 'sent', provider_message_id: providerMessageId, sent_at: new Date().toISOString(),
      last_error: null, updated_at: new Date().toISOString(),
    }).eq('idempotency_key', key)
    if (error) throw error
  },

  async markDeliveryFailed(key, message) {
    const { error } = await supabase.from('email_deliveries').update({
      status: 'failed', last_error: message.slice(0, 500), updated_at: new Date().toISOString(),
    }).eq('idempotency_key', key)
    if (error) throw error
  },
}
