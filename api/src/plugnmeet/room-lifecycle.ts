import { supabase } from '../lib/supabase'
import { plugNmeet } from './client'

// Webhooks are the immediate source of truth. This bounded sweep protects the
// Kanvise state machine when a provider delivery is delayed or unavailable.
export async function reconcileInactivePlugNmeetClasses(now = new Date(), limit = 100) {
  const { data: classes, error } = await (supabase as any).from('live_classes')
    .select('id, provider_room_id')
    .eq('classroom_provider', 'plugnmeet')
    .eq('status', 'live')
    .order('started_at', { ascending: true })
    .limit(limit)
  if (error) throw error

  let completed = 0
  let checked = 0
  for (const liveClass of classes || []) {
    const roomId = String(liveClass.provider_room_id || liveClass.id)
    try {
      checked += 1
      if (await plugNmeet.isRoomActive(roomId)) {
        await (supabase as any).from('live_classes').update({ provider_room_status: 'active', provider_room_checked_at: now.toISOString() })
          .eq('id', liveClass.id).eq('status', 'live')
        continue
      }
      const { error: updateError } = await (supabase as any).from('live_classes')
        .update({ status: 'completed', ended_at: now.toISOString(), provider_room_status: 'ended', provider_room_checked_at: now.toISOString() })
        .eq('id', liveClass.id).eq('status', 'live')
      if (updateError) throw updateError
      completed += 1
    } catch (error) {
      // A provider outage must never end a potentially active class.
      console.warn('[plugnmeet] room lifecycle reconciliation skipped room', { roomId, error })
    }
  }
  return { name: 'plugnmeet_room_lifecycle', checked, completed }
}
