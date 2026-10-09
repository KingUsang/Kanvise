-- A scheduled Kanvise live class has one durable row and one temporary
-- PlugNmeet room identity. These states distinguish "room prepared" from
-- "session actually running" so a browser click cannot create a false live
-- class or keep the classroom VM awake forever.

ALTER TABLE public.live_classes
  DROP CONSTRAINT IF EXISTS live_classes_status_check;

ALTER TABLE public.live_classes
  ADD CONSTRAINT live_classes_status_check
  CHECK (status IN (
    'scheduled', 'starting', 'ready', 'live', 'ending',
    'completed', 'interrupted', 'cancelled'
  ));

ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS start_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS room_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_provider_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_error_message TEXT;

-- Earlier code marked the row live immediately after createRoom. Those rooms
-- were prepared, not proven to have started. Preserve active provider evidence
-- while correctly returning merely prepared rooms to ready.
UPDATE public.live_classes
SET status = 'ready',
    room_ready_at = COALESCE(room_ready_at, started_at, updated_at),
    started_at = NULL,
    updated_at = now()
WHERE classroom_provider = 'plugnmeet'
  AND status = 'live'
  AND provider_room_status = 'ready';

CREATE INDEX IF NOT EXISTS idx_live_classes_provider_lifecycle_active
  ON public.live_classes(classroom_provider, status, scheduled_at)
  WHERE classroom_provider = 'plugnmeet'
    AND status IN ('starting', 'ready', 'live', 'ending');
