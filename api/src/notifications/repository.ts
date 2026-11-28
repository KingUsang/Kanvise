import { supabase } from '../lib/supabase'
import { courseAccessEnrolmentFilter, filterActiveLearnerIds, type StudentCourse } from '../lib/student-course-access'
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
  claimDelivery(key: string): Promise<boolean>
  markDeliverySent(key: string, providerMessageId: string | null): Promise<void>
  markDeliveryFailed(key: string, error: string): Promise<void>
  /** Per-channel delivery state (DEV-NTF-004). Optional so older doubles keep working. */
  channelAlreadySent?(key: ChannelKey): Promise<boolean>
  recordChannel?(key: ChannelKey, status: 'sent' | 'failed' | 'skipped', error?: string): Promise<void>
  /** Switches people changed (12 CFG-N, 09 SA-10). Optional so older doubles keep working. */
  getPreferences?(schoolId: string, personIds: string[], rowKeys: string[]): Promise<PreferenceRecord[]>
  /** The account's name, used as the email sender name (18 NTF-04). */
  getAccountName?(schoolId: string): Promise<string | null>
}

export type PreferenceRecord = {
  personId: string
  rowKey: string
  pushOn: boolean | null
  emailOn: boolean | null
}

export type ChannelKey = {
  schoolId: string; event: NotificationEvent; relatedEntityId: string; recipientId: string; channel: 'in_app' | 'push' | 'email'
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
      let data: Array<{ student_id: string }> | null
      let error: unknown

      if (selector.enrolment.type === 'course') {
        const { data: course, error: courseError } = await supabase.from('courses')
          .select('id, programme_id, sub_programme_id')
          .eq('id', selector.enrolment.id)
          .eq('school_id', schoolId)
          .maybeSingle()
        if (courseError) throw courseError
        if (!course) return []

        let subProgramme: { id: string; programme_id: string } | null = null
        if (course.sub_programme_id) {
          const { data: parent, error: parentError } = await supabase.from('sub_programmes')
            .select('id, programme_id')
            .eq('id', course.sub_programme_id)
            .eq('school_id', schoolId)
            .maybeSingle()
          if (parentError) throw parentError
          subProgramme = parent
        }

        const result = await supabase.from('enrolments')
          .select('student_id')
          .eq('school_id', schoolId)
          .or(courseAccessEnrolmentFilter(course as StudentCourse, subProgramme))
        data = result.data
        error = result.error
      } else {
        const column = `${selector.enrolment.type}_id`
        const result = await supabase.from('enrolments')
          .select('student_id')
          .eq('school_id', schoolId)
          .eq(column, selector.enrolment.id)
        data = result.data
        error = result.error
      }
      if (error) throw error
      recipientIds = [...new Set((data || []).map((row) => row.student_id as string))]
    }

    // Only people with an active Learner membership receive account content (DEV-NTF-001).
    recipientIds = await filterActiveLearnerIds(schoolId, recipientIds)
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

  async claimDelivery(key) {
    // One UPDATE decides the winner, so two workers never both send.
    const { data, error } = await (supabase as any).rpc('claim_email_delivery', { p_key: key, p_lease_seconds: 300 })
    if (error) throw error
    return Boolean(data)
  },

  async markDeliverySent(key, providerMessageId) {
    const { error } = await supabase.from('email_deliveries').update({
      status: 'sent', provider_message_id: providerMessageId, sent_at: new Date().toISOString(),
      last_error: null, claimed_until: null, updated_at: new Date().toISOString(),
    }).eq('idempotency_key', key)
    if (error) throw error
  },

  async markDeliveryFailed(key, message) {
    const { error } = await supabase.from('email_deliveries').update({
      status: 'failed', last_error: message.slice(0, 500), claimed_until: null, updated_at: new Date().toISOString(),
    }).eq('idempotency_key', key)
    if (error) throw error
  },
  async channelAlreadySent(key) {
    const { data, error } = await (supabase as any).from('notification_deliveries').select('status')
      .eq('school_id', key.schoolId).eq('event', key.event).eq('related_entity_id', key.relatedEntityId)
      .eq('recipient_id', key.recipientId).eq('channel', key.channel).maybeSingle()
    if (error) throw error
    return data?.status === 'sent'
  },

  async getPreferences(schoolId, personIds, rowKeys) {
    if (!personIds.length || !rowKeys.length) return []
    const { data, error } = await supabase.from('notification_preferences')
      .select('person_id, row_key, push_on, email_on')
      .eq('school_id', schoolId)
      .in('person_id', personIds)
      .in('row_key', rowKeys)
    if (error) throw error
    return (data || []).map((row) => ({ personId: row.person_id, rowKey: row.row_key, pushOn: row.push_on, emailOn: row.email_on }))
  },

  async getAccountName(schoolId) {
    const { data, error } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle()
    if (error) throw error
    return data?.name?.trim() || null
  },

  async recordChannel(key, status, message) {
    const { error } = await (supabase as any).rpc('record_notification_delivery', {
      p_school_id: key.schoolId, p_event: key.event, p_related_entity_id: key.relatedEntityId,
      p_recipient_id: key.recipientId, p_channel: key.channel, p_status: status, p_error: message ?? null,
    })
    if (error) throw error
  },
}
