-- The production database originally received this table outside the checked-in
-- migration history. Define it here so a clean environment can reproduce the
-- schema before installing the atomic invite-consumption function below.
CREATE TABLE IF NOT EXISTS public.tutor_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES public.user_profiles(id),
    supabase_auth_id UUID,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tutor_invites_email
    ON public.tutor_invites(email);
CREATE INDEX IF NOT EXISTS idx_tutor_invites_school_id
    ON public.tutor_invites(school_id);
CREATE INDEX IF NOT EXISTS idx_tutor_invites_status
    ON public.tutor_invites(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_invites_pending_unique
    ON public.tutor_invites(school_id, email)
    WHERE status = 'pending';

CREATE OR REPLACE FUNCTION consume_tutor_invite(
    p_invite_id UUID,
    p_email TEXT,
    p_supabase_auth_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_invite tutor_invites%ROWTYPE;
BEGIN
    SELECT * INTO v_invite
    FROM tutor_invites
    WHERE id = p_invite_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_NOT_FOUND'; END IF;
    IF lower(v_invite.email) <> lower(btrim(p_email)) THEN
        RAISE EXCEPTION 'INVITE_EMAIL_MISMATCH';
    END IF;
    IF v_invite.expires_at <= now() THEN
        UPDATE tutor_invites SET status = 'expired', updated_at = now()
        WHERE id = p_invite_id AND status = 'pending';
        RAISE EXCEPTION 'INVITE_EXPIRED';
    END IF;

    -- Callback retries by the same verified Auth user remain idempotent.
    IF v_invite.status = 'accepted'
       AND v_invite.supabase_auth_id = p_supabase_auth_id THEN
        RETURN v_invite.school_id;
    END IF;
    IF v_invite.status <> 'pending' THEN
        RAISE EXCEPTION 'INVITE_NOT_PENDING';
    END IF;

    UPDATE tutor_invites
    SET status = 'accepted',
        accepted_at = now(),
        updated_at = now(),
        supabase_auth_id = p_supabase_auth_id
    WHERE id = p_invite_id;

    RETURN v_invite.school_id;
END;
$$;

REVOKE ALL ON FUNCTION consume_tutor_invite(UUID, TEXT, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_tutor_invite(UUID, TEXT, UUID)
    TO service_role;
