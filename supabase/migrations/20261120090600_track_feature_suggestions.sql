-- Track public.feature_suggestions in the migration chain (DEV-DB-018).
--
-- The table already exists on staging but no earlier migration creates it, so a
-- fresh database lacked it and POST /suggestions failed there. This migration is
-- safe on both: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, no column
-- or row is dropped, and no existing data is changed.
--
-- Columns are the ones the API reads and writes (api/src/routes/suggestions.ts):
-- suggestion, email and status. id and created_at are housekeeping columns.

CREATE TABLE IF NOT EXISTS public.feature_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion text NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Staging may have the table with a different column set. Add anything missing.
-- The columns that carry NOT NULL do so with a default, so existing rows stay valid.
ALTER TABLE public.feature_suggestions ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.feature_suggestions ADD COLUMN IF NOT EXISTS suggestion text;
ALTER TABLE public.feature_suggestions ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.feature_suggestions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.feature_suggestions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Size limits matching the API (suggestion 1 to 2000 characters, email up to 320).
-- They are added NOT VALID because the staging rows were never checked against
-- them. NOT VALID still rejects new or updated rows that break a limit, and it
-- cannot fail on existing rows. Run VALIDATE CONSTRAINT once the data is known
-- to be clean.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.feature_suggestions'::regclass
      AND conname = 'feature_suggestions_suggestion_length_check'
  ) THEN
    ALTER TABLE public.feature_suggestions
      ADD CONSTRAINT feature_suggestions_suggestion_length_check
      CHECK (char_length(suggestion) BETWEEN 1 AND 2000) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.feature_suggestions'::regclass
      AND conname = 'feature_suggestions_email_length_check'
  ) THEN
    ALTER TABLE public.feature_suggestions
      ADD CONSTRAINT feature_suggestions_email_length_check
      CHECK (email IS NULL OR char_length(email) <= 320) NOT VALID;
  END IF;
END
$$;

-- Service-role-only access. Staging carried two permissive policies, "Allow
-- authenticated users to read" (SELECT, USING true) and "Allow public inserts"
-- (INSERT, WITH CHECK true). They are dormant while anon and authenticated have
-- no table grants, but would let any signed-in user read every suggestion and
-- anyone insert without the API's validation and rate limit if grants were ever
-- restored. The API writes with the service role, which bypasses RLS, so no
-- policy is needed. RLS stays enabled with no policies, which denies everything else.
ALTER TABLE public.feature_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read" ON public.feature_suggestions;
DROP POLICY IF EXISTS "Allow public inserts" ON public.feature_suggestions;

REVOKE ALL ON TABLE public.feature_suggestions FROM PUBLIC, anon, authenticated;
