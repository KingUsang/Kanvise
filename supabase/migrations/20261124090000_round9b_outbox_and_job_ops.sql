-- Round 9B: notification delivery state, atomic cancellation outbox and job
-- operations (DEV-NTF-004, DEV-LVC-004, DEV-INT-003). Service-role only. Nothing
-- here depends on legacy RLS policies or current_user_school_id().

-- Per-channel delivery state. One row per (event, entity, recipient, channel), so
-- a failed push never forces a re-send of an email that already succeeded.
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  event text NOT NULL,
  related_entity_id text NOT NULL,
  recipient_id text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_channel_check CHECK (channel IN ('in_app', 'push', 'email')),
  CONSTRAINT notification_deliveries_status_check CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  CONSTRAINT notification_deliveries_unique_key UNIQUE (school_id, event, related_entity_id, recipient_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status
  ON public.notification_deliveries (status, updated_at);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;

-- Record one channel attempt. A row already marked sent is never downgraded.
CREATE OR REPLACE FUNCTION public.record_notification_delivery(
  p_school_id uuid,
  p_event text,
  p_related_entity_id text,
  p_recipient_id text,
  p_channel text,
  p_status text,
  p_error text DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.notification_deliveries AS d
    (school_id, event, related_entity_id, recipient_id, channel, status, attempts, last_error, sent_at)
  VALUES
    (p_school_id, p_event, p_related_entity_id, p_recipient_id, p_channel, p_status, 1,
     left(p_error, 500), CASE WHEN p_status = 'sent' THEN now() END)
  ON CONFLICT (school_id, event, related_entity_id, recipient_id, channel) DO UPDATE
    SET status = EXCLUDED.status, attempts = d.attempts + 1, last_error = EXCLUDED.last_error,
        sent_at = CASE WHEN EXCLUDED.status = 'sent' THEN now() ELSE d.sent_at END, updated_at = now()
    WHERE d.status <> 'sent';
$$;

-- Job operations: dead-lettered jobs stay in durable_jobs as status 'failed'.
-- Operators can cancel a pending or failed job, or replay a failed or cancelled one.
ALTER TABLE public.durable_jobs DROP CONSTRAINT IF EXISTS durable_jobs_status_check;
ALTER TABLE public.durable_jobs ADD CONSTRAINT durable_jobs_status_check
  CHECK (status IN ('pending', 'running', 'complete', 'failed', 'cancelled'));

CREATE OR REPLACE FUNCTION public.cancel_durable_job(p_id uuid) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH updated AS (
    UPDATE public.durable_jobs
    SET status = 'cancelled', locked_by = NULL, locked_until = NULL, updated_at = now()
    WHERE id = p_id AND status IN ('pending', 'failed')
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

CREATE OR REPLACE FUNCTION public.replay_durable_job(p_id uuid) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH updated AS (
    UPDATE public.durable_jobs
    SET status = 'pending', attempts = 0, run_at = now(), last_error = NULL, completed_at = NULL,
        locked_by = NULL, locked_until = NULL, updated_at = now()
    WHERE id = p_id AND status IN ('failed', 'cancelled')
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

-- Cancel a scheduled class and record the notification intent in the same
-- transaction. The compare-and-set on status returns no row if another request
-- changed the class first, and then no job is queued.
CREATE OR REPLACE FUNCTION public.cancel_live_class_with_outbox(
  p_class_id uuid,
  p_school_id uuid,
  p_school_name text DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS SETOF public.live_classes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_class public.live_classes;
BEGIN
  UPDATE public.live_classes
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_class_id AND school_id = p_school_id AND status = 'scheduled'
  RETURNING * INTO v_class;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_class.course_id IS NOT NULL THEN
    INSERT INTO public.durable_jobs (job_type, dedupe_key, payload)
    VALUES (
      'notify_class_cancelled',
      'notify_class_cancelled:' || v_class.id::text,
      jsonb_build_object(
        'id', v_class.id, 'schoolId', v_class.school_id, 'schoolName', COALESCE(p_school_name, 'Your school'),
        'courseId', v_class.course_id, 'title', v_class.title,
        'scheduledAt', v_class.scheduled_at, 'reason', p_reason
      )
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN NEXT v_class;
END;
$$;

REVOKE ALL ON FUNCTION public.record_notification_delivery(uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_durable_job(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replay_durable_job(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_live_class_with_outbox(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_notification_delivery(uuid, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_durable_job(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.replay_durable_job(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_live_class_with_outbox(uuid, uuid, text, text) TO service_role;
