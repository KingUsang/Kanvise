import { supabase } from '../lib/supabase'
import { plugNmeet } from './client'

// Webhooks are the immediate source of truth. This bounded sweep protects the
// Kanvise state machine when a provider delivery is delayed or unavailable.
export async function reconcileInactivePlugNmeetClasses(now = new Date(), limit = 100) {
  const { data: classes, error } = await (supabase as any).from('live_classes')
    .select('id, provider_room_id, status, scheduled_at, duration_minutes, start_requested_at')
    .eq('classroom_provider', 'plugnmeet')
    .in('status', ['starting', 'ready', 'live', 'ending'])
    .order('scheduled_at', { ascending: true })
    .limit(limit)
  if (error) throw error

  let completed = 0
  let reset = 0
  let interrupted = 0
  let checked = 0
  for (const liveClass of classes || []) {
    const roomId = String(liveClass.provider_room_id || liveClass.id)
    try {
      checked += 1
      if (await plugNmeet.isRoomActive(roomId)) {
        // `isRoomActive` proves the provider room exists, not that a tutor or
        // learner joined. Only webhooks promote ready -> live.
        await (supabase as any).from('live_classes').update({
          provider_room_status: liveClass.status === 'starting' || liveClass.status === 'ready' ? 'ready' : 'active',
          provider_room_checked_at: now.toISOString(), provider_error_at: null, provider_error_message: null,
          ...(liveClass.status === 'starting' ? { status: 'ready', room_ready_at: now.toISOString() } : {}),
        }).eq('id', liveClass.id).eq('status', liveClass.status)
        continue
      }
      if (liveClass.status === 'starting' || liveClass.status === 'ready') {
        // Nobody entered before PlugNmeet's empty timeout. The scheduled class
        // can safely be started again with the same Kanvise class ID.
        const { error: resetError } = await (supabase as any).from('live_classes').update({
          status: 'scheduled', provider_room_status: 'ended', provider_room_checked_at: now.toISOString(),
          provider_error_at: null, provider_error_message: null,
        }).eq('id', liveClass.id).eq('status', liveClass.status)
        if (resetError) throw resetError
        reset += 1
        continue
      }
      const { error: updateError } = await (supabase as any).from('live_classes')
        .update({ status: 'completed', ended_at: now.toISOString(), provider_room_status: 'ended', provider_room_checked_at: now.toISOString() })
        .eq('id', liveClass.id).eq('status', liveClass.status)
      if (updateError) throw updateError
      completed += 1
    } catch (error) {
      // A temporary outage must never immediately end a potentially active
      // class. But a 15-minute class cannot truthfully remain "live" for days:
      // once its maximum window plus a generous hour has elapsed, surface it as
      // interrupted and let the VM idle safely.
      const deadline = new Date(new Date(liveClass.scheduled_at).getTime() + (Number(liveClass.duration_minutes || 240) + 60) * 60_000)
      const terminal = now >= deadline && (liveClass.status === 'live' || liveClass.status === 'ending')
      await (supabase as any).from('live_classes').update({
        ...(terminal ? { status: 'interrupted' } : {}),
        provider_room_status: 'unavailable', provider_room_checked_at: now.toISOString(),
        provider_error_at: now.toISOString(),
        provider_error_message: error instanceof Error ? error.message.slice(0, 500) : 'Provider state could not be checked',
      }).eq('id', liveClass.id).eq('status', liveClass.status)
      if (terminal) interrupted += 1
      console.warn('[plugnmeet] room lifecycle reconciliation skipped room', { roomId, error })
    }
  }
  return { name: 'plugnmeet_room_lifecycle', checked, completed, reset, interrupted }
}
