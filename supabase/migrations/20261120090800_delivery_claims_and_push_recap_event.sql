-- Atomic delivery claims for email and Web Push, and the missing push event type
-- (DEV-EML-001, DEV-EML-003, DEV-PSH-001, DEV-PSH-002).
--
-- A worker claims a delivery with one UPDATE that only succeeds when the row is
-- not sent and no other worker holds an unexpired claim, so two workers cannot
-- both send the same message. Service-role only. Nothing here depends on legacy
-- RLS policies or current_user_school_id().

ALTER TABLE public.email_deliveries ADD COLUMN IF NOT EXISTS claimed_until timestamptz;
ALTER TABLE public.push_deliveries ADD COLUMN IF NOT EXISTS claimed_until timestamptz;

-- The recap notification type exists in the application but not in the ledger
-- constraint, so a recap push would fail at the ledger.
ALTER TABLE public.push_deliveries DROP CONSTRAINT IF EXISTS push_deliveries_event_type_check;
ALTER TABLE public.push_deliveries ADD CONSTRAINT push_deliveries_event_type_check CHECK (event_type IN (
  'live_class_reminder', 'assignment_deadline', 'mock_published',
  'submission_graded', 'mock_fully_graded', 'class_cancelled', 'class_recap_ready'
));

CREATE OR REPLACE FUNCTION public.claim_email_delivery(p_key text, p_lease_seconds integer DEFAULT 300)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.email_deliveries
  SET status = 'pending', attempt_count = attempt_count + 1,
      claimed_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
  WHERE idempotency_key = p_key
    AND status <> 'sent'
    AND (claimed_until IS NULL OR claimed_until < now())
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_push_delivery(p_key text, p_lease_seconds integer DEFAULT 300)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.push_deliveries
  SET status = 'pending', attempt_count = attempt_count + 1, last_error = NULL,
      claimed_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
  WHERE idempotency_key = p_key
    AND status <> 'sent'
    AND (claimed_until IS NULL OR claimed_until < now())
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_delivery(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_push_delivery(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_delivery(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery(text, integer) TO service_role;
