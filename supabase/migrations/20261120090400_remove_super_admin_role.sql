-- DEV-DOM-003: super_admin is not an approved Kanvise role. The initial
-- schema still allows it in the user_profiles.role CHECK constraint, and one
-- RLS policy on schools still names it. No API code grants or checks it.
--
-- 1. Fail loudly if any Profile still carries the role, so an operator decides
--    what to do with those people. This migration never rewrites roles.
-- 2. Remove super_admin from the schools update policy, if that policy
--    exists. Staging has drifted (DEV-DB-018): it has neither the policy nor
--    public.current_user_school_id(). A missing policy is skipped with a
--    NOTICE; a policy that exists with another command, or without the
--    function, fails loudly.
-- 3. Add the replacement CHECK as NOT VALID, validate it, then drop the old
--    one, so there is no window without a role constraint. On staging the
--    original user_profiles_role_check already reads
--    CHECK (role = ANY (ARRAY['admin', 'tutor', 'student'])); it is dropped as
--    a duplicate of the replacement so every database ends with the same
--    single role CHECK.

DO $$
DECLARE
  violating_count bigint;
  other_roles text;
BEGIN
  SELECT count(*) INTO violating_count
  FROM public.user_profiles
  WHERE role = 'super_admin';

  IF violating_count > 0 THEN
    RAISE EXCEPTION
      E'Slice 3 pre-check failed (20261120090400): % user_profiles row(s) still have role = ''super_admin''.\nFind them with: select id, email, school_id from public.user_profiles where role = ''super_admin''.\nDecide with the owner whether each person becomes admin, tutor or student, or is removed, then re-run. This migration never rewrites roles. Nothing was changed.',
      violating_count;
  END IF;

  -- The replacement CHECK would also reject any other unexpected value.
  -- Report those here instead of failing later inside VALIDATE CONSTRAINT.
  SELECT string_agg(format('%L: %s row(s)', role_counts.role, role_counts.row_count), ', ' ORDER BY role_counts.role)
  INTO other_roles
  FROM (
    SELECT profile.role, count(*) AS row_count
    FROM public.user_profiles AS profile
    WHERE profile.role NOT IN ('admin', 'tutor', 'student')
    GROUP BY profile.role
  ) AS role_counts;

  IF other_roles IS NOT NULL THEN
    RAISE EXCEPTION
      E'Slice 3 pre-check failed (20261120090400): user_profiles has roles outside admin, tutor, student: %.\nFix those rows, then re-run. Nothing was changed.',
      other_roles;
  END IF;
END
$$;

DO $$
DECLARE
  existing_cmd text;
BEGIN
  SELECT existing.cmd INTO existing_cmd
  FROM pg_catalog.pg_policies AS existing
  WHERE existing.schemaname = 'public'
    AND existing.tablename = 'schools'
    AND existing.policyname = 'Admins can update their own school';

  IF NOT FOUND THEN
    RAISE NOTICE 'Slice 3 (20261120090400): policy "Admins can update their own school" on public.schools does not exist, skipped';
    RETURN;
  END IF;

  IF existing_cmd <> 'UPDATE' THEN
    RAISE EXCEPTION
      E'Slice 3 pre-check failed (20261120090400): policy "Admins can update their own school" on public.schools is FOR %, expected FOR UPDATE, so its USING clause cannot be rewritten safely.\nUpdate this migration for the real shape before it is applied. Nothing was changed.',
      existing_cmd;
  END IF;

  IF to_regprocedure('public.current_user_school_id()') IS NULL THEN
    RAISE EXCEPTION
      E'Slice 3 pre-check failed (20261120090400): policy "Admins can update their own school" on public.schools exists, but public.current_user_school_id() does not, and the rewritten policy needs it.\nUpdate this migration for the real schema before it is applied. Nothing was changed.';
  END IF;

  ALTER POLICY "Admins can update their own school"
  ON public.schools
  USING (
    id = public.current_user_school_id()
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
END
$$;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_supported_check
  CHECK (role IN ('admin', 'tutor', 'student')) NOT VALID;

ALTER TABLE public.user_profiles
  VALIDATE CONSTRAINT user_profiles_role_supported_check;

-- The original inline CHECK is named user_profiles_role_check by default.
-- Without relying on the name, drop every other CHECK on user_profiles that
-- either still names super_admin (clean rebuild) or has exactly the same
-- definition as the replacement (staging, where it was already narrowed).
DO $$
DECLARE
  replacement_definition text;
  old_constraint record;
BEGIN
  SELECT pg_catalog.pg_get_constraintdef(oid) INTO replacement_definition
  FROM pg_catalog.pg_constraint
  WHERE conrelid = 'public.user_profiles'::regclass
    AND conname = 'user_profiles_role_supported_check';

  FOR old_constraint IN
    SELECT conname
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND contype = 'c'
      AND conname <> 'user_profiles_role_supported_check'
      AND (
        pg_catalog.pg_get_constraintdef(oid) LIKE '%super_admin%'
        OR pg_catalog.pg_get_constraintdef(oid) = replacement_definition
      )
  LOOP
    EXECUTE format('ALTER TABLE public.user_profiles DROP CONSTRAINT %I', old_constraint.conname);
  END LOOP;
END
$$;
