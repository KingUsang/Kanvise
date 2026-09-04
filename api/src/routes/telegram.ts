import crypto from 'crypto'
import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, tenantMiddleware } from '../middleware/auth'
import type { TenantVariables } from '../types'
import { telegramApi, telegramConfigured } from '../telegram/client'
import { deliverTelegramMessage } from '../telegram/delivery'

const telegramDb = supabase as any
const CODE_TTL_MINUTES = 15

type TelegramUser = { id: number; username?: string; first_name?: string }
type TelegramChat = { id: number; type: 'private' | 'group' | 'supergroup' | 'channel'; title?: string; username?: string }
type TelegramMessage = { text?: string; chat: TelegramChat; from?: TelegramUser }
type TelegramUpdate = {
  message?: TelegramMessage
  channel_post?: TelegramMessage
  callback_query?: { id: string; data?: string; from: TelegramUser; message?: { chat: TelegramChat } }
  chat_join_request?: { chat: TelegramChat; from: TelegramUser }
}

function hashCode(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function createCode(): string {
  return crypto.randomBytes(24).toString('base64url')
}

function sameSecret(value: string, expected: string): boolean {
  const left = Buffer.from(value)
  const right = Buffer.from(expected)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function botUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '').trim() || null
}

async function createConnectionCode(input: { schoolId: string; userId: string; kind: 'group' | 'paid_group' | 'reminders' }) {
  const code = createCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString()
  const { error } = await telegramDb.from('telegram_connection_codes').insert({
    school_id: input.schoolId, user_id: input.userId, kind: input.kind,
    code_hash: hashCode(code), expires_at: expiresAt,
  })
  if (error) throw error
  return { code, expiresAt }
}

async function consumeConnectionCode(input: {
  code: string; kind: 'group' | 'paid_group' | 'reminders'; telegramUser: TelegramUser; chat: TelegramChat
}) {
  const { data: candidate, error } = await telegramDb.from('telegram_connection_codes')
    .select('*').eq('code_hash', hashCode(input.code)).eq('kind', input.kind).maybeSingle()
  if (error) throw error
  if (!candidate || candidate.consumed_at || new Date(candidate.expires_at).getTime() < Date.now()) {
    throw new Error('CONNECTION_CODE_INVALID')
  }

  if (input.kind === 'group' || input.kind === 'paid_group') {
    if (!['group', 'supergroup', 'channel'].includes(input.chat.type)) throw new Error('TELEGRAM_CHAT_REQUIRED')
    const existing = await telegramDb.from('telegram_chats').select('school_id')
      .eq('telegram_chat_id', input.chat.id).maybeSingle()
    if (existing.error) throw existing.error
    if (existing.data && existing.data.school_id !== candidate.school_id) throw new Error('GROUP_ALREADY_CONNECTED')
    const { error: chatError } = await telegramDb.from('telegram_chats').upsert({
      school_id: candidate.school_id, telegram_chat_id: input.chat.id, chat_type: input.chat.type,
      purpose: input.kind === 'paid_group' ? 'paid_teaching' : 'teaching',
      title: input.chat.title || null, username: input.chat.username || null, status: 'active',
      connected_by: candidate.user_id, connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'telegram_chat_id' })
    if (chatError) throw chatError
  } else {
    if (input.chat.type !== 'private' || input.chat.id !== input.telegramUser.id) throw new Error('PRIVATE_CHAT_REQUIRED')
    const { error: identityError } = await telegramDb.from('telegram_identities').upsert({
      school_id: candidate.school_id, user_id: candidate.user_id, telegram_user_id: input.telegramUser.id,
      private_chat_id: input.chat.id, username: input.telegramUser.username || null,
      first_name: input.telegramUser.first_name || null, reminders_enabled: true,
      linked_at: new Date().toISOString(), last_interaction_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'school_id,user_id' })
    if (identityError) throw identityError
  }

  const { data: consumed, error: consumeError } = await telegramDb.from('telegram_connection_codes').update({
    consumed_at: new Date().toISOString(), consumed_by_telegram_user_id: input.telegramUser.id, consumed_chat_id: input.chat.id,
  }).eq('id', candidate.id).is('consumed_at', null).select('id').maybeSingle()
  if (consumeError) throw consumeError
  if (!consumed) throw new Error('CONNECTION_CODE_INVALID')
  return candidate
}

export const telegramRouter = new Hono<{ Variables: TenantVariables }>()
telegramRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware)

telegramRouter.post('/connection-codes/group', requireRole('admin'), async (c) => {
  if (!telegramConfigured()) return c.json({ error: 'Telegram is not configured', code: 'TELEGRAM_NOT_CONFIGURED' }, 503)
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({})) as { purpose?: string }
  const paid = body.purpose === 'paid_teaching'
  const connection = await createConnectionCode({ schoolId: user.school_id, userId: user.id, kind: paid ? 'paid_group' : 'group' })
  return c.json({ data: {
    code: connection.code, expires_at: connection.expiresAt,
    instruction: `Add the Kanvise bot as an administrator, then send ${paid ? '/connect-paid' : '/connect'} ${connection.code} in the group${paid ? ' or channel' : ''}.`,
  } }, 201)
})

telegramRouter.post('/paid-access/challenges', requireRole('student'), async (c) => {
  if (!telegramConfigured() || !botUsername()) return c.json({ error: 'Telegram is not configured', code: 'TELEGRAM_NOT_CONFIGURED' }, 503)
  const user = c.get('user')
  const [{ data: paidChat, error }, { data: enrolment, error: enrolmentError }] = await Promise.all([
    telegramDb.from('telegram_chats').select('id')
    .eq('school_id', user.school_id).eq('purpose', 'paid_teaching').eq('status', 'active').maybeSingle()
    , supabase.from('enrolments').select('id').eq('school_id', user.school_id).eq('student_id', user.id).limit(1).maybeSingle(),
  ])
  if (error || enrolmentError) return c.json({ error: 'Could not prepare Telegram access' }, 500)
  if (!paidChat) return c.json({ error: 'This tutorial centre does not use a paid Telegram class group', code: 'PAID_TELEGRAM_NOT_ENABLED' }, 404)
  if (!enrolment) return c.json({ error: 'An active paid enrolment is required for this Telegram class.', code: 'PAID_ENROLMENT_REQUIRED' }, 403)
  const token = createCode()
  const { error: insertError } = await telegramDb.from('telegram_link_challenges').insert({
    school_id: user.school_id, user_id: user.id, token_hash: hashCode(token),
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
  })
  if (insertError) return c.json({ error: 'Could not prepare Telegram access' }, 500)
  return c.json({ data: { start_url: `https://t.me/${botUsername()}?start=link_${token}` } }, 201)
})

telegramRouter.post('/paid-access/confirm', requireRole('student'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({})) as { code?: string }
  if (!/^\d{6}$/.test(body.code || '')) return c.json({ error: 'Enter the six-digit code sent by the bot.' }, 400)
  const { data: challenge, error } = await telegramDb.from('telegram_link_challenges').select('*')
    .eq('school_id', user.school_id).eq('user_id', user.id).is('completed_at', null)
    .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error || !challenge || !challenge.telegram_user_id || !challenge.private_chat_id || !challenge.confirmation_code_hash
    || challenge.confirmation_expires_at < new Date().toISOString() || challenge.confirmation_code_hash !== hashCode(body.code!)) {
    return c.json({ error: 'That code is invalid or expired. Start the Telegram connection again.' }, 400)
  }
  const { error: identityError } = await telegramDb.from('telegram_identities').upsert({
    school_id: user.school_id, user_id: user.id, telegram_user_id: challenge.telegram_user_id,
    private_chat_id: challenge.private_chat_id, username: challenge.telegram_username, first_name: challenge.telegram_first_name,
    reminders_enabled: true, linked_at: new Date().toISOString(), last_interaction_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: 'school_id,user_id' })
  if (identityError) return c.json({ error: 'This Telegram account is already linked to another student.' }, 409)
  const { error: completeError } = await telegramDb.from('telegram_link_challenges').update({ completed_at: new Date().toISOString() }).eq('id', challenge.id)
  if (completeError) return c.json({ error: 'Could not complete Telegram connection' }, 500)
  const { data: paidChat } = await telegramDb.from('telegram_chats').select('telegram_chat_id')
    .eq('school_id', user.school_id).eq('purpose', 'paid_teaching').eq('status', 'active').maybeSingle()
  if (!paidChat) return c.json({ error: 'Paid Telegram group is no longer configured.' }, 404)
  const invite = await telegramApi.createJoinRequestInvite({ chatId: String(paidChat.telegram_chat_id), name: `Kanvise ${user.kanvise_user_id || user.id}`, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) })
  await telegramApi.sendMessage({ chatId: String(challenge.private_chat_id), text: '✅ Your Telegram account is linked to Kanvise. Request access to your paid class below.', button: { text: 'Request to join class', url: invite.inviteLink } })
  return c.json({ data: { linked: true, invite_sent: true } })
})

telegramRouter.post('/connection-codes/reminders', requireRole('student'), async (c) => {
  if (!telegramConfigured() || !botUsername()) return c.json({ error: 'Telegram is not configured', code: 'TELEGRAM_NOT_CONFIGURED' }, 503)
  const user = c.get('user')
  const connection = await createConnectionCode({ schoolId: user.school_id, userId: user.id, kind: 'reminders' })
  return c.json({ data: {
    expires_at: connection.expiresAt,
    start_url: `https://t.me/${botUsername()}?start=reminder_${connection.code}`,
  } }, 201)
})

telegramRouter.post('/attendance/windows', requireRole('admin', 'tutor'), async (c) => {
  if (!telegramConfigured()) return c.json({ error: 'Telegram is not configured', code: 'TELEGRAM_NOT_CONFIGURED' }, 503)
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({})) as { live_class_id?: string; telegram_chat_id?: string; window_minutes?: number }
  const windowMinutes = Number(body.window_minutes || 15)
  if (!body.live_class_id || !body.telegram_chat_id || !Number.isInteger(windowMinutes) || windowMinutes < 1 || windowMinutes > 60) {
    return c.json({ error: 'live_class_id, telegram_chat_id, and a 1–60 minute window are required' }, 400)
  }
  const [{ data: liveClass, error: classError }, { data: chat, error: chatError }] = await Promise.all([
    supabase.from('live_classes').select('id, school_id, title, course:courses(name)').eq('id', body.live_class_id).eq('school_id', user.school_id).maybeSingle(),
    telegramDb.from('telegram_chats').select('telegram_chat_id').eq('telegram_chat_id', body.telegram_chat_id).eq('school_id', user.school_id).eq('status', 'active').maybeSingle(),
  ])
  if (classError || chatError) return c.json({ error: 'Could not start Telegram attendance' }, 500)
  if (!liveClass || !chat) return c.json({ error: 'Class or active Telegram group not found' }, 404)
  const closesAt = new Date(Date.now() + windowMinutes * 60_000).toISOString()
  const { data: attendanceWindow, error } = await telegramDb.from('telegram_attendance_windows').insert({
    school_id: user.school_id, live_class_id: liveClass.id, telegram_chat_id: chat.telegram_chat_id,
    opened_by: user.id, closes_at: closesAt,
  }).select('id').single()
  if (error) return c.json({ error: 'An attendance window is already open for this class and group' }, 409)

  const result = await deliverTelegramMessage({
    idempotencyKey: `telegram:attendance_open:${attendanceWindow.id}`, schoolId: user.school_id,
    eventType: 'attendance_open', chatId: String(chat.telegram_chat_id),
    text: `📚 ${liveClass.title} has started.\n\nAttendance closes in ${windowMinutes} minutes.`,
    button: { text: '✓ Check in', callback_data: `attendance:${attendanceWindow.id}` },
  })
  return c.json({ data: { id: attendanceWindow.id, closes_at: closesAt, delivery: result } }, 201)
})

export const telegramWebhookRouter = new Hono()
telegramWebhookRouter.post('/webhook', async (c) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const providedSecret = c.req.header('X-Telegram-Bot-Api-Secret-Token') || ''
  if (!expectedSecret || !sameSecret(providedSecret, expectedSecret)) return c.json({ error: 'Unauthorised webhook' }, 401)
  const update = await c.req.json().catch(() => null) as TelegramUpdate | null
  if (!update) return c.json({ error: 'Invalid Telegram update' }, 400)

  // Telegram retries only failed webhooks. We deliberately acknowledge first;
  // callback/check-in actions are idempotent in the database.
  void handleTelegramUpdate(update).catch((error) => console.error('telegram.webhook_failed', { error }))
  return c.text('OK')
})

async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message || update.channel_post
  if (message?.text) {
    const { text, chat, from } = message
    const reminder = from && text.match(/^\/start\s+reminder_([A-Za-z0-9_-]+)$/)
    if (reminder && from) {
      try {
        await consumeConnectionCode({ code: reminder[1], kind: 'reminders', telegramUser: from, chat })
        await telegramApi.sendMessage({ chatId: String(chat.id), text: '✅ Personal Kanvise reminders are enabled for this school.' })
      } catch (error) {
        await telegramApi.sendMessage({ chatId: String(chat.id), text: 'That reminder link has expired or has already been used. Please create a new one in Kanvise.' })
        console.warn('telegram.reminder_link_failed', { error })
      }
      return
    }

    const link = from && text.match(/^\/start\s+link_([A-Za-z0-9_-]+)$/)
    if (link && from && chat.type === 'private') {
      const confirmationCode = String(crypto.randomInt(100000, 1_000_000))
      const { data, error } = await telegramDb.from('telegram_link_challenges').update({
        telegram_user_id: from.id, private_chat_id: chat.id, telegram_username: from.username || null,
        telegram_first_name: from.first_name || null, confirmation_code_hash: hashCode(confirmationCode),
        confirmation_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      }).eq('token_hash', hashCode(link[1])).is('completed_at', null).gt('expires_at', new Date().toISOString()).select('id').maybeSingle()
      if (error || !data) await telegramApi.sendMessage({ chatId: String(chat.id), text: 'This Telegram connection link has expired. Start again from Kanvise.' })
      else await telegramApi.sendMessage({ chatId: String(chat.id), text: `Your Kanvise confirmation code is: ${confirmationCode}\n\nReturn to Kanvise and enter this code to continue.` })
      return
    }

    const connect = text.match(/^\/(connect|connect-paid)\s+([A-Za-z0-9_-]+)$/)
    if (connect && ['group', 'supergroup', 'channel'].includes(chat.type)) {
      if (chat.type !== 'channel' && (!from || !['creator', 'administrator'].includes(await telegramApi.getChatMemberStatus(String(chat.id), String(from.id))))) {
        await telegramApi.sendMessage({ chatId: String(chat.id), text: 'Only a Telegram group administrator can connect this group.' })
        return
      }
      try {
        await consumeConnectionCode({ code: connect[2], kind: connect[1] === 'connect-paid' ? 'paid_group' : 'group', telegramUser: from || { id: 0 }, chat })
        await telegramApi.sendMessage({ chatId: String(chat.id), text: '✅ This Telegram group is now connected to Kanvise.' })
      } catch (error) {
        await telegramApi.sendMessage({ chatId: String(chat.id), text: 'This connection code is invalid, expired, or the group is already connected.' })
        console.warn('telegram.group_connect_failed', { error })
      }
    }
    return
  }

  if (update.chat_join_request) {
    const { chat, from } = update.chat_join_request
    const { data: paidChat } = await telegramDb.from('telegram_chats').select('school_id, telegram_chat_id')
      .eq('telegram_chat_id', chat.id).eq('purpose', 'paid_teaching').eq('status', 'active').maybeSingle()
    if (!paidChat) return
    const { data: identity } = await telegramDb.from('telegram_identities').select('user_id')
      .eq('school_id', paidChat.school_id).eq('telegram_user_id', from.id).eq('reminders_enabled', true).maybeSingle()
    if (!identity) return
    const { data: enrolment } = await supabase.from('enrolments').select('id').eq('school_id', paidChat.school_id).eq('student_id', identity.user_id).limit(1).maybeSingle()
    if (!enrolment) return
    await telegramApi.approveChatJoinRequest({ chatId: String(chat.id), userId: String(from.id) })
  }

  const callback = update.callback_query
  if (!callback?.data?.startsWith('attendance:') || !callback.message) return
  const windowId = callback.data.slice('attendance:'.length)
  try {
    const { data, error } = await telegramDb.rpc('record_telegram_attendance_checkin', {
      p_window_id: windowId, p_telegram_user_id: callback.from.id, p_chat_id: callback.message.chat.id,
    })
    if (error) throw error
    await telegramApi.answerCallbackQuery(callback.id, data?.checked_in ? 'You are checked in.' : 'You were already checked in.')
  } catch (error) {
    await telegramApi.answerCallbackQuery(callback.id, 'Unable to check you in. Enable reminders first or ask your tutor for help.')
    console.warn('telegram.attendance_checkin_failed', { error, windowId })
  }
}
