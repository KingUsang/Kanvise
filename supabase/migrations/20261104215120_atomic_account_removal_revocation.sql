CREATE OR REPLACE FUNCTION public.remove_user_from_school(
  p_target_user_id uuid,
  p_school_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_profile public.user_profiles%ROWTYPE;
BEGIN
  SELECT *
  INTO target_profile
  FROM public.user_profiles
  WHERE id = p_target_user_id
    AND school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('found', false);
  END IF;

  UPDATE public.user_profiles
  SET school_id = NULL,
      updated_at = pg_catalog.now()
  WHERE id = target_profile.id
    AND school_id = p_school_id;

  UPDATE public.student_centre_memberships
  SET status = 'revoked',
      revoked_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE student_id = target_profile.id
    AND school_id = p_school_id
    AND status = 'active';

  UPDATE public.account_invitations
  SET status = 'revoked',
      updated_at = pg_catalog.now()
  WHERE school_id = p_school_id
    AND (
      student_profile_id = target_profile.id
      OR pg_catalog.lower(email) = pg_catalog.lower(target_profile.email)
    )
    AND status = 'pending';

  RETURN pg_catalog.jsonb_build_object(
    'found', true,
    'role', target_profile.role,
    'supabase_auth_id', target_profile.supabase_auth_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_user_from_school(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_user_from_school(uuid, uuid) TO service_role;
