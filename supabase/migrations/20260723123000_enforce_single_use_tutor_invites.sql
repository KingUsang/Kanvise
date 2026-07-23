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
