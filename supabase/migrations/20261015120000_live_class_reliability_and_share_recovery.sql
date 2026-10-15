-- Provider rooms are disposable generations of one durable Kanvise class.
-- Public guest links remain hash-addressed, while the encrypted copy is only
-- returned to an authenticated class host for the in-room share action.
ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS provider_generation INTEGER NOT NULL DEFAULT 1 CHECK (provider_generation > 0),
  ADD COLUMN IF NOT EXISTS share_token_encrypted TEXT;

CREATE INDEX IF NOT EXISTS idx_live_classes_current_provider_room
  ON public.live_classes(provider_room_id)
  WHERE provider_room_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prepare_live_class_provider_recovery(
  p_live_class_id UUID,
  p_provider_room_id TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_generation INTEGER;
BEGIN
  UPDATE public.live_classes
  SET status = 'scheduled',
      provider_generation = provider_generation + 1,
      provider_room_id = NULL,
      provider_room_status = 'ended',
      provider_room_checked_at = now(),
      updated_at = now()
  WHERE id = p_live_class_id
    AND provider_room_id = p_provider_room_id
    AND status IN ('starting', 'ready', 'live')
  RETURNING provider_generation INTO next_generation;
  RETURN next_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_live_class_provider_recovery(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_live_class_provider_recovery(UUID, TEXT) TO service_role;

CREATE TABLE IF NOT EXISTS public.live_class_recording_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  live_class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recording_share_links_class
  ON public.live_class_recording_share_links(live_class_id, created_at DESC);
ALTER TABLE public.live_class_recording_share_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.live_class_recording_share_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.live_class_recording_share_links TO service_role;
