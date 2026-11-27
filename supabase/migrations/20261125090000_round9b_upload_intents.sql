-- Round 9B: single-use upload intents and orphan cleanup (DEV-UPL-002, DEV-UPL-003).
-- Service-role only. Nothing here depends on legacy RLS policies or current_user_school_id().

CREATE TABLE IF NOT EXISTS public.upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  scope text NOT NULL,
  entity_type text NOT NULL,
  context_id text NOT NULL,
  file_key text NOT NULL,
  content_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT upload_intents_scope_check CHECK (scope IN ('private', 'public')),
  CONSTRAINT upload_intents_status_check CHECK (status IN ('pending', 'consumed', 'expired')),
  CONSTRAINT upload_intents_file_key_key UNIQUE (file_key)
);

CREATE INDEX IF NOT EXISTS idx_upload_intents_pending_expiry
  ON public.upload_intents (expires_at) WHERE status = 'pending';

ALTER TABLE public.upload_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.upload_intents FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.upload_intents TO service_role;

-- Consume an intent exactly once. Returns one of: consumed, legacy (no intent was
-- recorded, so the key was presigned before this migration), forbidden (another
-- requester), already_consumed, expired.
CREATE OR REPLACE FUNCTION public.consume_upload_intent(
  p_school_id uuid, p_requester_id uuid, p_file_key text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_requester uuid;
  v_status text;
BEGIN
  UPDATE public.upload_intents
  SET status = 'consumed', consumed_at = now()
  WHERE school_id = p_school_id AND file_key = p_file_key AND requester_id = p_requester_id
    AND status = 'pending' AND expires_at > now()
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    RETURN 'consumed';
  END IF;

  SELECT requester_id, status INTO v_requester, v_status
  FROM public.upload_intents
  WHERE school_id = p_school_id AND file_key = p_file_key;
  IF NOT FOUND THEN
    RETURN 'legacy';
  END IF;
  IF v_requester <> p_requester_id THEN
    RETURN 'forbidden';
  END IF;
  IF v_status = 'consumed' THEN
    RETURN 'already_consumed';
  END IF;
  RETURN 'expired';
END;
$$;

-- Put a consumed intent back when registration failed, so the client can retry.
CREATE OR REPLACE FUNCTION public.release_upload_intent(
  p_school_id uuid, p_requester_id uuid, p_file_key text
) RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  UPDATE public.upload_intents
  SET status = 'pending', consumed_at = NULL
  WHERE school_id = p_school_id AND file_key = p_file_key AND requester_id = p_requester_id
    AND status = 'consumed';
$$;

-- Expire unconfirmed intents and queue deletion of their objects in one transaction.
CREATE OR REPLACE FUNCTION public.sweep_upload_intents(p_limit integer DEFAULT 200) RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH expired AS (
    UPDATE public.upload_intents
    SET status = 'expired'
    WHERE id IN (
      SELECT id FROM public.upload_intents
      WHERE status = 'pending' AND expires_at < now()
      ORDER BY expires_at
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    RETURNING school_id, scope, file_key
  ), queued AS (
    INSERT INTO public.durable_jobs (job_type, dedupe_key, payload)
    SELECT
      CASE WHEN scope = 'public' THEN 'delete_public_object' ELSE 'delete_private_object' END,
      CASE WHEN scope = 'public' THEN 'delete_public_object:' ELSE 'delete_private_object:' END || file_key,
      jsonb_build_object('fileKey', file_key, 'schoolId', school_id)
    FROM expired
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ), purged AS (
    -- Retention: settled intents older than 30 days no longer guard anything
    -- (their presigned URL and intent window are long gone).
    DELETE FROM public.upload_intents
    WHERE id IN (
      SELECT id FROM public.upload_intents
      WHERE status IN ('consumed', 'expired') AND created_at < now() - interval '30 days'
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    RETURNING 1
  )
  SELECT count(*)::integer FROM expired;
$$;

-- Delete question images never attached to a question or stimulus and queue
-- deletion of their objects (the editor registers an image before the question).
CREATE OR REPLACE FUNCTION public.sweep_orphan_question_media(
  p_older_than interval DEFAULT interval '7 days', p_limit integer DEFAULT 100
) RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH orphans AS (
    SELECT m.id FROM public.question_media m
    WHERE m.created_at < now() - p_older_than
      AND NOT EXISTS (SELECT 1 FROM public.bank_question_version_media v WHERE v.media_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM public.question_stimulus_media s WHERE s.media_id = m.id)
    ORDER BY m.created_at
    LIMIT p_limit
    FOR UPDATE OF m SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.question_media m
    USING orphans o
    WHERE m.id = o.id
    RETURNING m.school_id, m.storage_key
  ), queued AS (
    INSERT INTO public.durable_jobs (job_type, dedupe_key, payload)
    SELECT 'delete_private_object', 'delete_private_object:' || storage_key,
      jsonb_build_object('fileKey', storage_key, 'schoolId', school_id)
    FROM deleted
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer FROM deleted;
$$;

REVOKE ALL ON FUNCTION public.consume_upload_intent(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_upload_intent(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sweep_upload_intents(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sweep_orphan_question_media(interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_upload_intent(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_upload_intent(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_upload_intents(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_orphan_question_media(interval, integer) TO service_role;
