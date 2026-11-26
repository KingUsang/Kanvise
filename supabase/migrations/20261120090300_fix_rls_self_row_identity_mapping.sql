-- DEV-DB-015: the initial self-row RLS policies compared Profile UUID columns
-- (user_profiles.id, student_id, user_id) with auth.uid(), which is the
-- Supabase Auth UUID stored in user_profiles.supabase_auth_id. The two never
-- match, so a signed-in person could not see their own rows.
--
-- Each policy keeps its name, command and non-self conditions. Only the
-- identity comparison changes, to map auth.uid() to the Profile through
-- user_profiles.supabase_auth_id. ALTER POLICY is used so no policy is ever
-- missing. Table grants for anon/authenticated stay revoked
-- (20260723130000), so this is dormant until direct access is restored.
--
-- Not changed here: the notification delivery policies from
-- 20260720145358 already use the correct mapping.

ALTER POLICY "Users can view profiles in their school"
ON public.user_profiles
USING (
  school_id = public.current_user_school_id() OR supabase_auth_id = (SELECT auth.uid())
);

ALTER POLICY "Users can update their own profile"
ON public.user_profiles
USING (
  supabase_auth_id = (SELECT auth.uid()) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);

ALTER POLICY "Users can view their own enrolments or admins view all school enrolments"
ON public.enrolments
USING (
  student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))
);

ALTER POLICY "Users can view their own payments or admins view school payments"
ON public.payments
USING (
  student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);

ALTER POLICY "Students view attendance, admins/tutors manage"
ON public.attendance_records
USING (
  school_id = public.current_user_school_id() AND (student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))
);

ALTER POLICY "Students view their own submissions, tutors view assigned course submissions"
ON public.submissions
USING (
  student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))
);

ALTER POLICY "Students can insert their own submissions"
ON public.submissions
WITH CHECK (
  student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) AND school_id = public.current_user_school_id()
);

ALTER POLICY "Students view and create their own attempts"
ON public.mock_attempts
USING (
  student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))
);

ALTER POLICY "Students manage their own answers during active attempt"
ON public.mock_answers
USING (
  attempt_id IN (SELECT attempt.id FROM public.mock_attempts AS attempt WHERE attempt.student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid()))) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))
);

ALTER POLICY "Enrolled students can create reviews"
ON public.reviews
WITH CHECK (
  student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) AND school_id = public.current_user_school_id()
);

ALTER POLICY "Users view and manage their own notifications"
ON public.notifications
USING (
  user_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);
