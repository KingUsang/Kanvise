-- PlugNmeet enrolled-class pilot. Guest/link classes remain on LiveKit.
ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS classroom_provider TEXT NOT NULL DEFAULT 'livekit',
  ADD COLUMN IF NOT EXISTS provider_room_id TEXT;

ALTER TABLE public.live_classes
  DROP CONSTRAINT IF EXISTS live_classes_classroom_provider_check;
ALTER TABLE public.live_classes
  ADD CONSTRAINT live_classes_classroom_provider_check
  CHECK (classroom_provider IN ('livekit', 'plugnmeet'));

CREATE UNIQUE INDEX IF NOT EXISTS live_classes_provider_room_unique
  ON public.live_classes(provider_room_id)
  WHERE provider_room_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.plugnmeet_webhook_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id TEXT NOT NULL UNIQUE,
  event_name TEXT NOT NULL,
  room_id TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS public.live_class_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  live_class_id UUID REFERENCES public.live_classes(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_type, live_class_id)
);

CREATE TABLE IF NOT EXISTS public.live_class_transcription_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id UUID NOT NULL UNIQUE REFERENCES public.live_classes(id) ON DELETE CASCADE,
  provider_egress_id TEXT,
  status TEXT NOT NULL DEFAULT 'starting' CHECK (status IN ('starting', 'active', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_class_transcript_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  speaker TEXT NOT NULL DEFAULT 'tutor',
  text TEXT NOT NULL,
  is_final BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(live_class_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS public.live_class_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id UUID NOT NULL UNIQUE REFERENCES public.live_classes(id) ON DELETE CASCADE,
  provider_recording_id TEXT,
  r2_file_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'transferring', 'ready', 'failed')),
  content_type TEXT,
  file_size_bytes BIGINT,
  checksum TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_class_quick_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL UNIQUE,
  questions JSONB NOT NULL,
  provider_poll_id TEXT,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'published', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.live_class_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id UUID NOT NULL UNIQUE REFERENCES public.live_classes(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  draft_body TEXT,
  published_body TEXT,
  raw_transcript_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_plugnmeet_webhook_inbox_unprocessed
  ON public.plugnmeet_webhook_inbox(processed_at, received_at);
CREATE INDEX IF NOT EXISTS idx_live_class_jobs_pending
  ON public.live_class_jobs(status, available_at);
CREATE INDEX IF NOT EXISTS idx_live_class_transcript_chunks_class
  ON public.live_class_transcript_chunks(live_class_id, sequence_number);
