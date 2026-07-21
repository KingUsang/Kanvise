-- Track publication notification completion independently from publication so
-- temporary delivery failures remain retryable without reverting mock status.
ALTER TABLE public.mock_exams
  ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_mock_exams_pending_publication_notification
ON public.mock_exams(publish_at)
WHERE status IN ('draft', 'published')
  AND publish_at IS NOT NULL
  AND notification_sent = false;
