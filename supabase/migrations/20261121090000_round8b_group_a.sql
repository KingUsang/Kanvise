-- Round 8B group A.
--
-- DEV-CLS-012: bind a Class creation key to a canonical request fingerprint so
-- a retry with edited input is rejected instead of silently replaying the first
-- Class. Nullable: Classes created before this migration have no fingerprint
-- and keep the old replay behaviour.
ALTER TABLE public.programmes
  ADD COLUMN IF NOT EXISTS creation_fingerprint text;

COMMENT ON COLUMN public.programmes.creation_fingerprint IS
  'SHA-256 of the canonical setup request that created this Class under creation_key (DEV-CLS-012).';

-- DEV-JOB-002: the onboarding job now scans only recently created Admin and
-- Tutor accounts, oldest first.
CREATE INDEX IF NOT EXISTS user_profiles_staff_created_at_idx
  ON public.user_profiles (created_at)
  WHERE role IN ('admin', 'tutor');
