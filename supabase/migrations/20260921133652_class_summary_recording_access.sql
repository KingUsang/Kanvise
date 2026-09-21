-- Complete the enrolled-class recording and tutor-reviewed summary workflow.
ALTER TABLE public.live_class_recaps
  DROP CONSTRAINT IF EXISTS live_class_recaps_status_check;

ALTER TABLE public.live_class_recaps
  ADD CONSTRAINT live_class_recaps_status_check
  CHECK (status IN ('pending', 'generating', 'draft', 'published', 'failed'));

ALTER TABLE public.live_class_recaps
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS model_metadata JSONB;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'live_class_reminder',
    'assignment_deadline',
    'mock_published',
    'payment_confirmed',
    'enrolment_confirmed',
    'submission_graded',
    'mock_fully_graded',
    'class_cancelled',
    'class_recap_ready'
  ));

CREATE INDEX IF NOT EXISTS idx_live_class_recaps_status
  ON public.live_class_recaps(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_live_class_recordings_status
  ON public.live_class_recordings(status, updated_at);

ALTER TABLE public.live_class_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_recaps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.live_class_recordings FROM PUBLIC;
REVOKE ALL ON TABLE public.live_class_recordings FROM anon;
REVOKE ALL ON TABLE public.live_class_recaps FROM PUBLIC;
REVOKE ALL ON TABLE public.live_class_recaps FROM anon;
GRANT ALL ON TABLE public.live_class_recordings TO service_role;
GRANT ALL ON TABLE public.live_class_recaps TO service_role;
