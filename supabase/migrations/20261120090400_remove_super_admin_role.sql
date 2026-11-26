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
BEGIN
  SELECT count(*) INTO violating_count
  FROM public.user_profiles
  WHERE role = 'super_admin';

  IF violating_count > 0 THEN
    RAISE EXCEPTION
      'Cannot remove super_admin: % user_profiles rows still have role = ''super_admin''. Reassign or remove them first.',
      violating_count;
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
