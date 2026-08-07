import { deliverTelegramMessage } from './delivery'
import { supabase } from '../lib/supabase'

const telegramDb = supabase as any

export async function closeDueTelegramAttendanceWindows(now = new Date()): Promise<{ closed: number; failures: number }> {
  const { data: dueWindows, error } = await telegramDb.from('telegram_attendance_windows')
    .select('id, school_id, live_class_id, telegram_chat_id, live_class:live_classes(title)')
    .eq('status', 'open').lte('closes_at', now.toISOString()).limit(100)
  if (error) throw error

  let closed = 0
  let failures = 0
  for (const window of dueWindows || []) {
    // The status predicate claims the row and makes this safe across restarts
    // and multiple scheduler processes.
    const { data: claimed, error: claimError } = await telegramDb.from('telegram_attendance_windows').update({
      status: 'closed', closed_at: now.toISOString(),
    }).eq('id', window.id).eq('status', 'open').select('id').maybeSingle()
    if (claimError || !claimed) {
      if (claimError) failures += 1
      continue
    }
    closed += 1
    const { count, error: countError } = await telegramDb.from('telegram_attendance_checkins')
      .select('id', { count: 'exact', head: true }).eq('attendance_window_id', window.id)
    if (countError) {
      failures += 1
      continue
    }
    const title = (window.live_class as { title?: string } | null)?.title || 'Lesson'
    const delivery = await deliverTelegramMessage({
      idempotencyKey: `telegram:attendance_closed:${window.id}`,
      schoolId: window.school_id,
      eventType: 'attendance_closed',
      chatId: String(window.telegram_chat_id),
      text: `✅ Attendance closed — ${title}\n\n${count || 0} student${count === 1 ? '' : 's'} checked in.`,
    })
    if (delivery === 'failed') failures += 1
  }
  return { closed, failures }
}
