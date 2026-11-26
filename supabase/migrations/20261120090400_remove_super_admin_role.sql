-- DEV-DOM-003: super_admin is not an approved Kanvise role. The initial
-- schema still allows it in the user_profiles.role CHECK constraint, and one
-- RLS policy on schools still names it. No API code grants or checks it.
--
-- 1. Fail loudly if any Profile still carries the role, so an operator decides
--    what to do with those people. This migration never rewrites roles.
-- 2. Remove super_admin from the schools update policy.
-- 3. Add the replacement CHECK as NOT VALID, validate it, then drop the old
--    one, so there is no window without a role constraint.

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

ALTER POLICY "Admins can update their own school"
ON public.schools
USING (
  id = public.current_user_school_id()
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_supported_check
  CHECK (role IN ('admin', 'tutor', 'student')) NOT VALID;

ALTER TABLE public.user_profiles
  VALIDATE CONSTRAINT user_profiles_role_supported_check;

-- The original inline CHECK is named user_profiles_role_check by default.
-- Drop whichever CHECK still names super_admin, without relying on the name.
DO $$
DECLARE
  old_constraint record;
BEGIN
  FOR old_constraint IN
    SELECT conname
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND contype = 'c'
      AND conname <> 'user_profiles_role_supported_check'
      AND pg_catalog.pg_get_constraintdef(oid) LIKE '%super_admin%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_profiles DROP CONSTRAINT %I', old_constraint.conname);
  END LOOP;
END
$$;
