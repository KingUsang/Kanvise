-- Browser uploads go straight to private R2. The API records the upload first
-- and PDF inspection happens outside the tutor's request path.
ALTER TABLE public.live_class_presentations
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'ready'
    CHECK (processing_status IN ('uploading', 'processing', 'ready', 'failed')),
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

ALTER TABLE public.live_class_presentations
  ALTER COLUMN page_count DROP NOT NULL;

ALTER TABLE public.live_class_presentations
  DROP CONSTRAINT IF EXISTS live_class_presentations_page_count_check,
  DROP CONSTRAINT IF EXISTS live_class_presentations_page_in_range;

ALTER TABLE public.live_class_presentations
  ADD CONSTRAINT live_class_presentations_page_count_check
    CHECK (page_count IS NULL OR page_count BETWEEN 1 AND 50),
  ADD CONSTRAINT live_class_presentations_page_in_range
    CHECK (page_count IS NULL OR current_page <= page_count),
  ADD CONSTRAINT live_class_presentations_ready_requires_page_count
    CHECK (processing_status <> 'ready' OR page_count IS NOT NULL),
  ADD CONSTRAINT live_class_presentations_failed_has_error
    CHECK (processing_status <> 'failed' OR processing_error IS NOT NULL);

CREATE INDEX IF NOT EXISTS live_class_presentations_processing_idx
  ON public.live_class_presentations(processing_status, created_at)
  WHERE processing_status IN ('uploading', 'processing');
