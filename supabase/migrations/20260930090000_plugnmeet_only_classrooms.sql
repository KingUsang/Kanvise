-- LiveKit is retired. Future rows cannot silently fall back to a provider that
-- no longer has a running room service; historical completed records stay
-- available for their recordings and attendance history.
UPDATE public.live_classes
SET status = 'cancelled',
    ended_at = COALESCE(ended_at, now())
WHERE classroom_provider = 'livekit'
  AND status IN ('scheduled', 'live');

ALTER TABLE public.live_classes
  ALTER COLUMN classroom_provider SET DEFAULT 'plugnmeet';

ALTER TABLE public.live_classes
  DROP CONSTRAINT IF EXISTS live_classes_classroom_provider_check;

ALTER TABLE public.live_classes
  ADD CONSTRAINT live_classes_classroom_provider_check
  -- Completed and cancelled legacy records retain their original provider for
  -- audit/history only. They cannot be started or joined by the PlugNmeet-only
  -- API, while all future actionable classes must be PlugNmeet.
  CHECK (classroom_provider = 'plugnmeet' OR status IN ('completed', 'cancelled'));
