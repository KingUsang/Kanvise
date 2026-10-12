CREATE TABLE public.account_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('tutor', 'student')),
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  auth_started_at timestamptz,
  supabase_auth_id uuid,
  student_profile_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  tutor_invite_id uuid REFERENCES public.tutor_invites(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT account_invitations_student_profile CHECK (
    (role = 'student' AND student_profile_id IS NOT NULL)
    OR (role = 'tutor' AND student_profile_id IS NULL)
  )
);

CREATE UNIQUE INDEX account_invitations_pending_recipient
  ON public.account_invitations (school_id, role, lower(email))
  WHERE status = 'pending';

CREATE INDEX account_invitations_status_expiry
  ON public.account_invitations (status, expires_at);

ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_invitations FROM anon, authenticated;
GRANT ALL ON public.account_invitations TO service_role;

CREATE OR REPLACE FUNCTION public.consume_account_invitation(
  p_token_hash text,
  p_email text,
  p_supabase_auth_id uuid
)
RETURNS public.account_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation public.account_invitations%ROWTYPE;
BEGIN
  SELECT * INTO invitation
  FROM public.account_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF lower(invitation.email) <> lower(btrim(p_email)) THEN RAISE EXCEPTION 'INVITATION_EMAIL_MISMATCH'; END IF;

  IF invitation.status = 'accepted' AND invitation.supabase_auth_id = p_supabase_auth_id THEN
    RETURN invitation;
  END IF;
  IF invitation.expires_at <= now() THEN
    UPDATE public.account_invitations SET status = 'expired', updated_at = now()
    WHERE id = invitation.id AND status = 'pending';
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;
  IF invitation.status <> 'pending' THEN RAISE EXCEPTION 'INVITATION_NOT_PENDING'; END IF;
  IF invitation.supabase_auth_id IS NOT NULL AND invitation.supabase_auth_id <> p_supabase_auth_id THEN
    RAISE EXCEPTION 'INVITATION_AUTH_USER_MISMATCH';
  END IF;

  UPDATE public.account_invitations
  SET status = 'accepted', accepted_at = now(), updated_at = now(), supabase_auth_id = p_supabase_auth_id
  WHERE id = invitation.id
  RETURNING * INTO invitation;

  IF invitation.tutor_invite_id IS NOT NULL THEN
    UPDATE public.tutor_invites
    SET status = 'accepted', accepted_at = now(), updated_at = now(), supabase_auth_id = p_supabase_auth_id
    WHERE id = invitation.tutor_invite_id
      AND (status = 'pending' OR (status = 'accepted' AND supabase_auth_id = p_supabase_auth_id));
  END IF;

  RETURN invitation;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_account_invitation(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_account_invitation(text, text, uuid) TO service_role;
