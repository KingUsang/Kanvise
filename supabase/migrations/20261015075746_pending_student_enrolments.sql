CREATE TABLE public.pending_student_enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  programme_id uuid NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  UNIQUE (student_profile_id, programme_id)
);

CREATE INDEX pending_student_enrolments_school_idx
  ON public.pending_student_enrolments (school_id);

ALTER TABLE public.pending_student_enrolments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pending_student_enrolments FROM anon, authenticated;
GRANT ALL ON public.pending_student_enrolments TO service_role;

-- Earlier imports created real enrolments before the learner accepted. Move
-- only unpaid admin-import rows for still-pending profiles; paid and active
-- access remains untouched.
INSERT INTO public.pending_student_enrolments
  (school_id, student_profile_id, programme_id, invited_by, created_at)
SELECT e.school_id, e.student_id, e.programme_id, e.granted_by, e.enrolled_at
FROM public.enrolments e
JOIN public.user_profiles p ON p.id = e.student_id
WHERE e.source = 'admin_import'
  AND e.payment_id IS NULL
  AND e.programme_id IS NOT NULL
  AND p.onboarding_status = 'invited'
ON CONFLICT (student_profile_id, programme_id) DO NOTHING;

DELETE FROM public.enrolments e
USING public.user_profiles p
WHERE p.id = e.student_id
  AND e.source = 'admin_import'
  AND e.payment_id IS NULL
  AND e.programme_id IS NOT NULL
  AND p.onboarding_status = 'invited';

-- Acceptance and enrolment promotion are one locked transaction for both
-- Google and email/password flows.
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
  IF invitation.status = 'accepted' AND invitation.supabase_auth_id = p_supabase_auth_id THEN RETURN invitation; END IF;
  IF invitation.expires_at <= now() THEN
    UPDATE public.account_invitations SET status = 'expired', updated_at = now()
    WHERE id = invitation.id AND status = 'pending';
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;
  IF invitation.status <> 'pending' THEN RAISE EXCEPTION 'INVITATION_NOT_PENDING'; END IF;
  IF invitation.supabase_auth_id IS NOT NULL AND invitation.supabase_auth_id <> p_supabase_auth_id THEN
    RAISE EXCEPTION 'INVITATION_AUTH_USER_MISMATCH';
  END IF;

  IF invitation.role = 'student' THEN
    UPDATE public.user_profiles
    SET supabase_auth_id = p_supabase_auth_id
    WHERE id = invitation.student_profile_id
      AND school_id = invitation.school_id
      AND role = 'student'
      AND (supabase_auth_id IS NULL OR supabase_auth_id = p_supabase_auth_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_PROFILE_MISMATCH'; END IF;

    INSERT INTO public.enrolments
      (school_id, student_id, programme_id, payment_id, source, granted_by, imported_at)
    SELECT pending.school_id, pending.student_profile_id, pending.programme_id,
      NULL, 'admin_import', pending.invited_by, now()
    FROM public.pending_student_enrolments pending
    WHERE pending.student_profile_id = invitation.student_profile_id
      AND NOT EXISTS (
        SELECT 1 FROM public.enrolments enrolled
        WHERE enrolled.student_id = pending.student_profile_id
          AND enrolled.programme_id = pending.programme_id
      );

    DELETE FROM public.pending_student_enrolments
    WHERE student_profile_id = invitation.student_profile_id;
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
