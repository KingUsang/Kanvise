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
  CHECK (classroom_provider = 'plugnmeet');
