-- A mock can name its subject independently of a centre programme, and its
-- first share link is configured while the mock is being built.
ALTER TABLE public.mock_exams
  ADD COLUMN IF NOT EXISTS subject_name text,
  ADD COLUMN IF NOT EXISTS direct_link_access_mode text NOT NULL DEFAULT 'free_claim'
    CHECK (direct_link_access_mode IN ('free_claim', 'paid')),
  ADD COLUMN IF NOT EXISTS direct_link_price_kobo bigint NOT NULL DEFAULT 0
    CHECK (direct_link_price_kobo >= 0),
  ADD COLUMN IF NOT EXISTS direct_link_slug text;

CREATE INDEX IF NOT EXISTS mock_exams_direct_link_slug_idx
  ON public.mock_exams (direct_link_slug)
  WHERE direct_link_slug IS NOT NULL;
