-- Keep the trusted Supabase Auth tenant claim aligned when a standalone
-- student adopts their first centre through programme/course enrolment.
CREATE OR REPLACE FUNCTION public.sync_student_school_auth_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role = 'student'
    AND NEW.supabase_auth_id IS NOT NULL
    AND NEW.school_id IS DISTINCT FROM OLD.school_id
  THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('school_id', NEW.school_id),
        updated_at = now()
    WHERE id = NEW.supabase_auth_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_student_school_auth_claim() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_student_school_auth_claim() FROM anon;
REVOKE ALL ON FUNCTION public.sync_student_school_auth_claim() FROM authenticated;

DROP TRIGGER IF EXISTS sync_student_school_auth_claim_after_update ON public.user_profiles;
CREATE TRIGGER sync_student_school_auth_claim_after_update
AFTER UPDATE OF school_id ON public.user_profiles
FOR EACH ROW
WHEN (NEW.school_id IS DISTINCT FROM OLD.school_id)
EXECUTE FUNCTION public.sync_student_school_auth_claim();

-- Repair students enrolled before this trigger existed, including accounts
-- whose Auth metadata contains an explicit stale null/different value.
UPDATE auth.users AS auth_user
SET raw_app_meta_data = COALESCE(auth_user.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('school_id', profile.school_id),
    updated_at = now()
FROM public.user_profiles AS profile
WHERE profile.supabase_auth_id = auth_user.id
  AND profile.role = 'student'
  AND profile.school_id IS NOT NULL
  AND (auth_user.raw_app_meta_data ->> 'school_id') IS DISTINCT FROM profile.school_id::text;
