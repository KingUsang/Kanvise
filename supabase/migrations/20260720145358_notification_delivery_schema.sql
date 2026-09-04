-- Extend the existing notification model for every documented delivery event.
ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'live_class_reminder',
    'assignment_deadline',
    'mock_published',
    'payment_confirmed',
    'enrolment_confirmed',
    'submission_graded',
    'mock_fully_graded',
    'class_cancelled'
  ));

-- Notification creation is server-owned. Signed-in users may only read their
-- own notifications and change the read state of their own rows.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notifications FROM PUBLIC;
REVOKE ALL ON TABLE public.notifications FROM anon;
REVOKE ALL ON TABLE public.notifications FROM authenticated;
GRANT SELECT, UPDATE (is_read) ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

CREATE POLICY "Users can read their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE user_profiles.id = notifications.user_id
      AND user_profiles.supabase_auth_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Users can update their own notification read state"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE user_profiles.id = notifications.user_id
      AND user_profiles.supabase_auth_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE user_profiles.id = notifications.user_id
      AND user_profiles.supabase_auth_id = (SELECT auth.uid())
  )
);
