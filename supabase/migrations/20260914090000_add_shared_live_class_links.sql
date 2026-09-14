-- A live class may be a normal centre class or a low-friction class shared by link.
-- Guest records are private server-side state: public clients never query them.

ALTER TABLE public.live_classes
  ALTER COLUMN course_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'enrolled_learners',
  ADD COLUMN IF NOT EXISTS share_token_hash TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_link_revoked_at TIMESTAMPTZ,
  ADD CONSTRAINT live_classes_access_mode_check CHECK (access_mode IN ('enrolled_learners', 'anyone_with_link')),
  ADD CONSTRAINT live_classes_enrolled_requires_course CHECK (
    access_mode <> 'enrolled_learners' OR course_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_live_classes_share_token_hash
  ON public.live_classes(share_token_hash) WHERE share_token_hash IS NOT NULL;

CREATE TABLE public.live_class_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  live_class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 60),
  session_token_hash TEXT NOT NULL UNIQUE CHECK (length(session_token_hash) = 64),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_live_class_guests_class ON public.live_class_guests(live_class_id, expires_at);

CREATE TABLE public.guest_live_class_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  live_class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES public.live_class_guests(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL,
  left_at TIMESTAMPTZ,
  duration_seconds INTEGER
);

CREATE INDEX idx_guest_live_class_attendance_open
  ON public.guest_live_class_attendance(live_class_id, guest_id) WHERE left_at IS NULL;

ALTER TABLE public.live_class_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_live_class_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.live_class_guests, public.guest_live_class_attendance FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.live_class_guests, public.guest_live_class_attendance TO service_role;
