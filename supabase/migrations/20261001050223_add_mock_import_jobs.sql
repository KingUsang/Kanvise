-- Durable, tutor-owned document-import state. The raw source lives in private
-- object storage; this table contains only the job lifecycle and the editable
-- structured draft returned by the reader.
CREATE TABLE public.mock_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'retrying', 'completed', 'failed', 'cancelled')),
  phase TEXT NOT NULL DEFAULT 'queued'
    CHECK (phase IN ('queued', 'uploading', 'extracting', 'analysing', 'normalising', 'review_ready', 'failed', 'cancelled')),
  source_file_key TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  source_content_type TEXT NOT NULL,
  source_size_bytes INTEGER NOT NULL CHECK (source_size_bytes > 0 AND source_size_bytes <= 15728640),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('pdf', 'docx')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 3),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  page_count INTEGER CHECK (page_count IS NULL OR page_count > 0),
  pages_processed INTEGER NOT NULL DEFAULT 0 CHECK (pages_processed >= 0),
  question_count INTEGER NOT NULL DEFAULT 0 CHECK (question_count >= 0),
  review_question_count INTEGER NOT NULL DEFAULT 0 CHECK (review_question_count >= 0),
  discovered_subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  result JSONB,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((status = 'completed') = (phase = 'review_ready')),
  CHECK (status <> 'completed' OR result IS NOT NULL),
  CHECK (status <> 'failed' OR (error_code IS NOT NULL AND error_message IS NOT NULL))
);

CREATE INDEX idx_mock_import_jobs_pending
  ON public.mock_import_jobs (status, available_at, created_at)
  WHERE status IN ('queued', 'retrying');

CREATE INDEX idx_mock_import_jobs_tutor
  ON public.mock_import_jobs (school_id, tutor_id, created_at DESC);

ALTER TABLE public.mock_import_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mock_import_jobs FROM PUBLIC;
REVOKE ALL ON TABLE public.mock_import_jobs FROM anon;
GRANT ALL ON TABLE public.mock_import_jobs TO service_role;
