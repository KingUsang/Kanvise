-- Durable jobs and scheduler leases (ADR 0006; DEV-ARC-006, DEV-ARC-007,
-- DEV-JOB-004, DEV-UPL-011, DEV-WHK-003).
--
-- Adds a PostgreSQL job table claimed with FOR UPDATE SKIP LOCKED leases, a
-- scheduler lease table so two API processes cannot run the same scheduled job,
-- lease columns for the existing live_class_jobs rows, and an outcome column for
-- the PlugNmeet webhook inbox. Everything is service-role only. Nothing here
-- depends on legacy RLS policies or current_user_school_id().

CREATE TABLE IF NOT EXISTS public.durable_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  dedupe_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  locked_until timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT durable_jobs_status_check CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  CONSTRAINT durable_jobs_attempts_check CHECK (attempts >= 0 AND max_attempts >= 1),
  CONSTRAINT durable_jobs_dedupe_key_key UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_durable_jobs_claim
  ON public.durable_jobs (status, run_at);

ALTER TABLE public.durable_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.durable_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.durable_jobs TO service_role;

CREATE TABLE IF NOT EXISTS public.scheduler_leases (
  name text PRIMARY KEY,
  holder text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduler_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scheduler_leases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.scheduler_leases TO service_role;

-- Lease columns for recording jobs: a crashed worker leaves status = 'running'
-- forever today. locked_until lets another worker take the job over.
ALTER TABLE public.live_class_jobs ADD COLUMN IF NOT EXISTS locked_by text;
ALTER TABLE public.live_class_jobs ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- Explicit outcome for webhook events that need no work (DEV-WHK-003).
ALTER TABLE public.plugnmeet_webhook_inbox ADD COLUMN IF NOT EXISTS outcome text;

-- Create or re-arm a job. An active (pending or running) job with the same key
-- is left alone, so repeated enqueues are idempotent. A completed job is reset. A
-- failed job is only re-armed after six hours, so a producer that scans every
-- minute cannot restart a poison job's retry cycle forever.
CREATE OR REPLACE FUNCTION public.enqueue_durable_job(
  p_job_type text,
  p_dedupe_key text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_run_at timestamptz DEFAULT now(),
  p_max_attempts integer DEFAULT 5
) RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH upserted AS (
    INSERT INTO public.durable_jobs AS j (job_type, dedupe_key, payload, run_at, max_attempts)
    VALUES (p_job_type, p_dedupe_key, COALESCE(p_payload, '{}'::jsonb), p_run_at, p_max_attempts)
    ON CONFLICT (dedupe_key) DO UPDATE
      SET status = 'pending', attempts = 0, payload = EXCLUDED.payload, run_at = EXCLUDED.run_at,
          max_attempts = EXCLUDED.max_attempts, locked_by = NULL, locked_until = NULL,
          last_error = NULL, completed_at = NULL, updated_at = now()
      WHERE j.status = 'complete'
         OR (j.status = 'failed' AND j.updated_at < now() - interval '6 hours')
    RETURNING j.id
  )
  SELECT COALESCE(
    (SELECT id FROM upserted),
    (SELECT id FROM public.durable_jobs WHERE dedupe_key = p_dedupe_key)
  );
$$;

-- Claim a bounded batch. Jobs whose lease expired are taken over; those that
-- already used every attempt are failed instead of retried forever.
CREATE OR REPLACE FUNCTION public.claim_durable_jobs(
  p_job_types text[],
  p_worker text,
  p_limit integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 300
) RETURNS SETOF public.durable_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.durable_jobs
  SET status = 'failed', last_error = COALESCE(last_error, 'Lease expired after the final attempt'),
      locked_by = NULL, locked_until = NULL, updated_at = now()
  WHERE job_type = ANY (p_job_types)
    AND status = 'running'
    AND locked_until < now()
    AND attempts >= max_attempts;

  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.durable_jobs
    WHERE job_type = ANY (p_job_types)
      AND attempts < max_attempts
      AND ((status = 'pending' AND run_at <= now()) OR (status = 'running' AND locked_until < now()))
    ORDER BY run_at, created_at
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.durable_jobs AS j
  SET status = 'running', attempts = j.attempts + 1, locked_by = p_worker,
      locked_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.extend_durable_job_lease(
  p_id uuid,
  p_worker text,
  p_lease_seconds integer DEFAULT 300
) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH updated AS (
    UPDATE public.durable_jobs
    SET locked_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
    WHERE id = p_id AND status = 'running' AND locked_by = p_worker
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

CREATE OR REPLACE FUNCTION public.complete_durable_job(
  p_id uuid,
  p_worker text
) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH updated AS (
    UPDATE public.durable_jobs
    SET status = 'complete', completed_at = now(), last_error = NULL,
        locked_by = NULL, locked_until = NULL, updated_at = now()
    WHERE id = p_id AND status = 'running' AND locked_by = p_worker
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

-- Record a failure. The job returns to pending after p_retry_seconds, or
-- becomes failed once its attempts are used up.
CREATE OR REPLACE FUNCTION public.fail_durable_job(
  p_id uuid,
  p_worker text,
  p_error text,
  p_retry_seconds integer DEFAULT 60
) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH updated AS (
    UPDATE public.durable_jobs
    SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
        last_error = left(p_error, 500),
        run_at = now() + make_interval(secs => p_retry_seconds),
        locked_by = NULL, locked_until = NULL, updated_at = now()
    WHERE id = p_id AND status = 'running' AND locked_by = p_worker
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

-- Take or renew a named lease. Returns true only for the current holder, so two
-- scheduler processes cannot both run the same job.
CREATE OR REPLACE FUNCTION public.acquire_scheduler_lease(
  p_name text,
  p_holder text,
  p_ttl_seconds integer
) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH taken AS (
    INSERT INTO public.scheduler_leases AS l (name, holder, expires_at, updated_at)
    VALUES (p_name, p_holder, now() + make_interval(secs => p_ttl_seconds), now())
    ON CONFLICT (name) DO UPDATE
      SET holder = EXCLUDED.holder, expires_at = EXCLUDED.expires_at, updated_at = now()
      WHERE l.holder = EXCLUDED.holder OR l.expires_at < now()
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM taken);
$$;

CREATE OR REPLACE FUNCTION public.release_scheduler_lease(
  p_name text,
  p_holder text
) RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  UPDATE public.scheduler_leases
  SET expires_at = now(), updated_at = now()
  WHERE name = p_name AND holder = p_holder;
$$;

REVOKE ALL ON FUNCTION public.enqueue_durable_job(text, text, jsonb, timestamptz, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_durable_jobs(text[], text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.extend_durable_job_lease(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_durable_job(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_durable_job(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acquire_scheduler_lease(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_scheduler_lease(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_durable_job(text, text, jsonb, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_durable_jobs(text[], text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.extend_durable_job_lease(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_durable_job(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_durable_job(uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_scheduler_lease(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_scheduler_lease(text, text) TO service_role;
