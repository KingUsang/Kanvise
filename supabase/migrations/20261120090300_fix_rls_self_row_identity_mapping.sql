-- DEV-DB-015: the initial self-row RLS policies compared Profile UUID columns
-- (user_profiles.id, student_id, user_id) with auth.uid(), which is the
-- Supabase Auth UUID stored in user_profiles.supabase_auth_id. The two never
-- match, so a signed-in person could not see their own rows.
--
-- Each policy keeps its name, command and non-self conditions. Only the
-- identity comparison changes, to map auth.uid() to the Profile through
-- user_profiles.supabase_auth_id. ALTER POLICY is used so no policy is ever
-- missing while it is rewritten. Table grants for anon/authenticated stay revoked
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

-- Drifted databases: staging has none of these eleven policies and no
-- public.current_user_school_id() function, although both are created by
-- 20260706000001 (DEV-DB-018). So:
--   * a missing policy is skipped with a NOTICE naming it;
--   * a policy that exists is rewritten only if its command matches the one
--     created in 20260706000001 (the clause rewritten, USING or WITH CHECK,
--     depends on it) and public.current_user_school_id() exists, because the
--     rewritten expressions keep the original account condition. Otherwise
--     the migration fails with "Slice 3 pre-check failed", before any change.
DO $$
DECLARE
  spec record;
  existing_cmd text;
  has_school_function boolean;
  problems text := '';
  missing_policies text[] := ARRAY[]::text[];
  statements text[] := ARRAY[]::text[];
  stmt text;
BEGIN
  has_school_function := to_regprocedure('public.current_user_school_id()') IS NOT NULL;

  -- Check every policy and build its ALTER POLICY first; nothing is changed
  -- until all of them have passed.
  FOR spec IN
    SELECT * FROM (VALUES
    (1, 'user_profiles', 'Users can view profiles in their school', 'SELECT', 'USING',
     $expr$school_id = public.current_user_school_id() OR supabase_auth_id = (SELECT auth.uid())$expr$),
    (2, 'user_profiles', 'Users can update their own profile', 'UPDATE', 'USING',
     $expr$supabase_auth_id = (SELECT auth.uid()) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')$expr$),
    (3, 'enrolments', 'Users can view their own enrolments or admins view all school e', 'SELECT', 'USING',
     $expr$student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))$expr$),
    (4, 'payments', 'Users can view their own payments or admins view school payment', 'SELECT', 'USING',
     $expr$student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')$expr$),
    (5, 'attendance_records', 'Students view attendance, admins/tutors manage', 'ALL', 'USING',
     $expr$school_id = public.current_user_school_id() AND (student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))$expr$),
    (6, 'submissions', 'Students view their own submissions, tutors view assigned cours', 'SELECT', 'USING',
     $expr$student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))$expr$),
    (7, 'submissions', 'Students can insert their own submissions', 'INSERT', 'WITH CHECK',
     $expr$student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) AND school_id = public.current_user_school_id()$expr$),
    (8, 'mock_attempts', 'Students view and create their own attempts', 'ALL', 'USING',
     $expr$student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))$expr$),
    (9, 'mock_answers', 'Students manage their own answers during active attempt', 'ALL', 'USING',
     $expr$attempt_id IN (SELECT attempt.id FROM public.mock_attempts AS attempt WHERE attempt.student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid()))) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'tutor'))$expr$),
    (10, 'reviews', 'Enrolled students can create reviews', 'INSERT', 'WITH CHECK',
     $expr$student_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) AND school_id = public.current_user_school_id()$expr$),
    (11, 'notifications', 'Users view and manage their own notifications', 'ALL', 'USING',
     $expr$user_id IN (SELECT profile.id FROM public.user_profiles AS profile WHERE profile.supabase_auth_id = (SELECT auth.uid())) OR (school_id = public.current_user_school_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')$expr$)
    ) AS t(sort_order, table_name, policy_name, expected_cmd, clause, expression)
    ORDER BY sort_order
  LOOP
    SELECT existing.cmd INTO existing_cmd
    FROM pg_catalog.pg_policies AS existing
    WHERE existing.schemaname = 'public'
      AND existing.tablename = spec.table_name
      AND existing.policyname = spec.policy_name;

    IF NOT FOUND THEN
      missing_policies := missing_policies || format('"%s" on public.%s', spec.policy_name, spec.table_name);
      CONTINUE;
    END IF;

    IF existing_cmd <> spec.expected_cmd THEN
      problems := problems || format(
        E'\n  %s on public.%s is FOR %s, expected FOR %s, so its %s clause cannot be rewritten safely',
        spec.policy_name, spec.table_name, existing_cmd, spec.expected_cmd, spec.clause
      );
    ELSIF NOT has_school_function THEN
      problems := problems || format(
        E'\n  %s on public.%s exists, but public.current_user_school_id() does not, and the rewritten policy needs it',
        spec.policy_name, spec.table_name
      );
    ELSE
      statements := statements || format(
        'ALTER POLICY %I ON public.%I %s (%s)',
        spec.policy_name, spec.table_name, spec.clause, spec.expression
      );
    END IF;
  END LOOP;

  IF problems <> '' THEN
    RAISE EXCEPTION
      E'Slice 3 pre-check failed (20261120090300): these RLS policies exist but cannot be rewritten safely:%\nCompare with: select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = ''public''. Update this migration for the real shape before it is applied. Nothing was changed.',
      problems;
  END IF;

  FOREACH stmt IN ARRAY statements LOOP
    EXECUTE stmt;
  END LOOP;

  FOREACH stmt IN ARRAY missing_policies LOOP
    RAISE NOTICE 'Slice 3 (20261120090300): policy % does not exist, skipped', stmt;
  END LOOP;

  RAISE NOTICE 'Slice 3 (20261120090300): % self-row policies rewritten, % missing and skipped',
    cardinality(statements), cardinality(missing_policies);
END
$$;
