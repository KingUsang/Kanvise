-- A tutor may stop and restart recording during one class. Each provider
-- recording is retained as an immutable segment; the existing
-- live_class_recordings row remains the class-level, student-facing result.
CREATE TABLE IF NOT EXISTS public.live_class_recording_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  provider_recording_id TEXT NOT NULL UNIQUE,
  r2_file_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploaded', 'failed')),
  content_type TEXT NOT NULL DEFAULT 'video/mp4',
  file_size_bytes BIGINT,
  checksum TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_class_recording_segments_class
  ON public.live_class_recording_segments(live_class_id, created_at);

-- The processing job is now solely for transcription and summaries. The MP4
-- reaches R2 directly from the recorder's post_transcoding hook.
ALTER TABLE public.live_class_recordings
  DROP CONSTRAINT IF EXISTS live_class_recordings_status_check;
ALTER TABLE public.live_class_recordings
  ADD CONSTRAINT live_class_recordings_status_check
  CHECK (status IN ('pending', 'uploaded', 'ready', 'failed'));

ALTER TABLE public.live_class_jobs
  DROP CONSTRAINT IF EXISTS live_class_jobs_status_check;
ALTER TABLE public.live_class_jobs
  ADD CONSTRAINT live_class_jobs_status_check
  CHECK (status IN ('pending', 'running', 'waiting', 'complete', 'failed'));

-- These tables are internal service-role tables; they must not be exposed to
-- browser clients through the Data API.
ALTER TABLE public.live_class_recording_segments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.live_class_recording_segments FROM PUBLIC;
REVOKE ALL ON TABLE public.live_class_recording_segments FROM anon;
REVOKE ALL ON TABLE public.live_class_recording_segments FROM authenticated;
GRANT ALL ON TABLE public.live_class_recording_segments TO service_role;
