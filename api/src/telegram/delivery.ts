import { supabase } from '../lib/supabase'
import { telegramApi, telegramConfigured, type TelegramApi, type TelegramButton } from './client'

// These tables are intentionally server-only. Database types are regenerated
// after the migration is applied; keeping this narrow cast avoids weakening the
// types of the rest of the API before that deployment step.
const telegramDb = supabase as any

export type TelegramDeliveryInput = {
  idempotencyKey: string
  schoolId: string
  userId?: string
  eventType: string
  chatId: string
  text: string
  button?: TelegramButton
  identityId?: string
}

export type TelegramDeliveryResult = 'sent' | 'already_sent' | 'skipped' | 'failed'

function messageError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : 'Unknown Telegram delivery error'
}

export async function deliverTelegramMessage(
  input: TelegramDeliveryInput,
  api: TelegramApi = telegramApi,
): Promise<TelegramDeliveryResult> {
  if (!telegramConfigured()) return 'skipped'

  const { error: createError } = await telegramDb.from('telegram_deliveries').upsert({
    idempotency_key: input.idempotencyKey,
    school_id: input.schoolId,
    user_id: input.userId || null,
    telegram_identity_id: input.identityId || null,
    telegram_chat_id: input.chatId,
    event_type: input.eventType,
    message_text: input.text,
    action_text: input.button?.text || null,
    action_url: input.button?.url || null,
  }, { onConflict: 'idempotency_key', ignoreDuplicates: true })
  if (createError) throw createError

  const { data: delivery, error: findError } = await telegramDb.from('telegram_deliveries')
    .select('id, status, attempt_count').eq('idempotency_key', input.idempotencyKey).single()
  if (findError || !delivery) throw findError || new Error('Telegram delivery record not found')
  if (delivery.status === 'sent') return 'already_sent'

  const { error: attemptError } = await telegramDb.from('telegram_deliveries').update({
    status: 'pending', attempt_count: delivery.attempt_count + 1, updated_at: new Date().toISOString(),
  }).eq('id', delivery.id)
  if (attemptError) throw attemptError

  try {
    const result = await api.sendMessage({ chatId: input.chatId, text: input.text, button: input.button })
    const { error } = await telegramDb.from('telegram_deliveries').update({
      status: 'sent', telegram_message_id: result.messageId, sent_at: new Date().toISOString(),
      last_error: null, updated_at: new Date().toISOString(),
    }).eq('id', delivery.id)
    if (error) throw error
    return 'sent'
  } catch (error) {
    await telegramDb.from('telegram_deliveries').update({
      status: 'failed', last_error: messageError(error), updated_at: new Date().toISOString(),
    }).eq('id', delivery.id)
    return 'failed'
  }
}

export async function deliverTelegramToStudent(input: {
  schoolId: string; userId: string; eventType: string; relatedEntityId: string; text: string; button?: TelegramButton
}): Promise<TelegramDeliveryResult> {
  if (!telegramConfigured()) return 'skipped'
  const { data: identity, error } = await telegramDb.from('telegram_identities')
    .select('id, private_chat_id').eq('school_id', input.schoolId).eq('user_id', input.userId)
    .eq('reminders_enabled', true).maybeSingle()
  if (error) throw error
  if (!identity) return 'skipped'
  return deliverTelegramMessage({
    idempotencyKey: `telegram:${input.eventType}:${input.relatedEntityId}:${input.userId}`,
    schoolId: input.schoolId, userId: input.userId, identityId: identity.id,
    eventType: input.eventType, chatId: String(identity.private_chat_id), text: input.text, button: input.button,
  })
}

export async function deliverTelegramToSchoolGroups(input: {
  schoolId: string; eventType: string; relatedEntityId: string; text: string; button?: TelegramButton
}): Promise<TelegramDeliveryResult[]> {
  if (!telegramConfigured()) return ['skipped']
  const { data: chats, error } = await telegramDb.from('telegram_chats')
    .select('id, telegram_chat_id').eq('school_id', input.schoolId).eq('status', 'active')
  if (error) throw error
  return Promise.all((chats || []).map((chat: { id: string; telegram_chat_id: string }) => deliverTelegramMessage({
    idempotencyKey: `telegram:group:${input.eventType}:${input.relatedEntityId}:${chat.id}`,
    schoolId: input.schoolId, eventType: input.eventType, chatId: String(chat.telegram_chat_id), text: input.text, button: input.button,
  })))
}

export async function announceTelegramClassReminder(input: {
  schoolId: string; liveClassId: string; title: string; startsAt: string
}) {
  const time = new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' })
    .format(new Date(input.startsAt))
  return deliverTelegramToSchoolGroups({
    schoolId: input.schoolId, eventType: 'lesson_reminder', relatedEntityId: input.liveClassId,
    text: `📚 ${input.title} starts at ${time} today in this group.`,
  })
}
