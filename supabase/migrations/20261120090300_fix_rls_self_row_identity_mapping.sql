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
--
-- Policy names: PostgreSQL keeps only the first 63 bytes of an identifier
-- (NAMEDATALEN - 1). Three policies in 20260706000001 have longer names, so
-- they were stored truncated and pg_policies holds the short form. They were
-- never dropped, renamed or replaced by a later migration, and they still
-- compare student_id with auth.uid(). This migration uses the stored names:
--   enrolments:  "Users can view their own enrolments or admins view all school e"
--                (created as "...admins view all school enrolments")
--   payments:    "Users can view their own payments or admins view school payment"
--                (created as "...admins view school payments")
--   submissions: "Students view their own submissions, tutors view assigned cours"
--                (created as "...tutors view assigned course submissions")

-- Pre-check: every policy altered below must exist. ALTER POLICY on a missing
-- policy fails with a bare "policy does not exist" error, so list all missing
-- names at once and say what to do.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(format('%s on public.%s', expected.policy_name, expected.table_name), E'\n  ' ORDER BY expected.table_name, expected.policy_name)
  INTO missing
  FROM (VALUES
    ('user_profiles',      'Users can view profiles in their school'),
    ('user_profiles',      'Users can update their own profile'),
    ('enrolments',         'Users can view their own enrolments or admins view all school e'),
    ('payments',           'Users can view their own payments or admins view school payment'),
    ('attendance_records', 'Students view attendance, admins/tutors manage'),
    ('submissions',        'Students view their own submissions, tutors view assigned cours'),
    ('submissions',        'Students can insert their own submissions'),
    ('mock_attempts',      'Students view and create their own attempts'),
    ('mock_answers',       'Students manage their own answers during active attempt'),
    ('reviews',            'Enrolled students can create reviews'),
    ('notifications',      'Users view and manage their own notifications')
  ) AS expected(table_name, policy_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies AS existing
    WHERE existing.schemaname = 'public'
      AND existing.tablename = expected.table_name
      AND existing.policyname = expected.policy_name
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      E'Slice 3 pre-check failed (20261120090300): these RLS policies do not exist, so their self-row identity cannot be fixed:\n  %\nCompare with: select tablename, policyname from pg_policies where schemaname = ''public''. If a policy was renamed or dropped on purpose, update this migration before it is applied. Nothing was changed.',
      missing;
  END IF;
END
$$;

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

ALTER POLICY "Users can view their own enrolments or admins view all school e"
ON public.enrolments
USING (
  student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))
);

ALTER POLICY "Users can view their own payments or admins view school payment"
ON public.payments
USING (
  student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);

ALTER POLICY "Students view attendance, admins/tutors manage"
ON public.attendance_records
USING (
  school_id = public.current_user_school_id() AND (student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))
);

ALTER POLICY "Students view their own submissions, tutors view assigned cours"
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
