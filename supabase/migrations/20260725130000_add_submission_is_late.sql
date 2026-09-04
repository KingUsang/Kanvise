-- The initial schema defined submissions.is_late but the remote table lacks it
-- (schema drift). Idempotent so environments that already have it are safe.
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT false;
