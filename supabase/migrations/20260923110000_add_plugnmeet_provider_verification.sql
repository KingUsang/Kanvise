-- A database "live" row is not enough evidence that a classroom is usable.
-- Keep the last provider observation separate from the product lifecycle state
-- so dashboards can never present an unverified provider room as live.
ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS provider_room_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS provider_room_checked_at TIMESTAMPTZ;

ALTER TABLE public.live_classes
  DROP CONSTRAINT IF EXISTS live_classes_provider_room_status_check;
ALTER TABLE public.live_classes
  ADD CONSTRAINT live_classes_provider_room_status_check
  CHECK (provider_room_status IN ('unknown', 'ready', 'active', 'ended', 'unavailable'));

CREATE INDEX IF NOT EXISTS idx_live_classes_provider_room_verification
  ON public.live_classes(classroom_provider, status, provider_room_status)
  WHERE classroom_provider = 'plugnmeet';
