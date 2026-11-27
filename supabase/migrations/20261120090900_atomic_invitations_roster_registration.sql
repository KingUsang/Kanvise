-- Slice 6A: atomic invitation, registration, roster import and account setup
-- commands (DEV-AUTH-001/003/004/006/008/009, DEV-INV-001/002/004, DEV-USR-001/002,
-- DEV-SCH-001). Every function is service_role only and does not depend on
-- legacy RLS helpers.

-- DEV-INV-004: an expired token used to raise after marking the row expired,
-- which rolled the status change back. Persist the expiry and return the row so
-- the caller can reject it without losing the state change. Callers must treat
-- any status other than 'accepted' as a rejection.
CREATE OR REPLACE FUNCTION public.consume_account_invitation(
  p_token_hash text,
  p_email text,
  p_supabase_auth_id uuid
)
RETURNS public.account_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invitation public.account_invitations%ROWTYPE;
BEGIN
  SELECT * INTO invitation
  FROM public.account_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF pg_catalog.lower(invitation.email) <> pg_catalog.lower(pg_catalog.btrim(p_email)) THEN
    RAISE EXCEPTION 'INVITATION_EMAIL_MISMATCH';
  END IF;
  IF invitation.status = 'accepted' AND invitation.supabase_auth_id = p_supabase_auth_id THEN
    RETURN invitation;
  END IF;
  IF invitation.status = 'pending' AND invitation.expires_at <= pg_catalog.now() THEN
    UPDATE public.account_invitations
    SET status = 'expired', updated_at = pg_catalog.now()
    WHERE id = invitation.id
    RETURNING * INTO invitation;
    IF invitation.tutor_invite_id IS NOT NULL THEN
      UPDATE public.tutor_invites
      SET status = 'expired', updated_at = pg_catalog.now()
      WHERE id = invitation.tutor_invite_id AND status = 'pending';
    END IF;
    RETURN invitation;
  END IF;
  IF invitation.status <> 'pending' THEN RAISE EXCEPTION 'INVITATION_NOT_PENDING'; END IF;
  IF invitation.supabase_auth_id IS NOT NULL AND invitation.supabase_auth_id <> p_supabase_auth_id THEN
    RAISE EXCEPTION 'INVITATION_AUTH_USER_MISMATCH';
  END IF;

  IF invitation.role = 'student' THEN
    UPDATE public.user_profiles
    SET supabase_auth_id = p_supabase_auth_id
    WHERE id = invitation.student_profile_id
      AND role = 'student'
      AND (supabase_auth_id IS NULL OR supabase_auth_id = p_supabase_auth_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_PROFILE_MISMATCH'; END IF;

    INSERT INTO public.enrolments
      (school_id, student_id, programme_id, payment_id, source, granted_by, imported_at)
    SELECT pending.school_id, pending.student_profile_id, pending.programme_id,
      NULL, 'admin_import', pending.invited_by, pg_catalog.now()
    FROM public.pending_student_enrolments pending
    WHERE pending.student_profile_id = invitation.student_profile_id
      AND pending.school_id = invitation.school_id
      AND NOT EXISTS (
        SELECT 1 FROM public.enrolments enrolled
        WHERE enrolled.student_id = pending.student_profile_id
          AND enrolled.programme_id = pending.programme_id
      );

    DELETE FROM public.pending_student_enrolments
    WHERE student_profile_id = invitation.student_profile_id
      AND school_id = invitation.school_id;
  END IF;

  UPDATE public.account_invitations
  SET status = 'accepted', accepted_at = pg_catalog.now(), updated_at = pg_catalog.now(),
      supabase_auth_id = p_supabase_auth_id
  WHERE id = invitation.id
  RETURNING * INTO invitation;

  IF invitation.tutor_invite_id IS NOT NULL THEN
    UPDATE public.tutor_invites
    SET status = 'accepted', accepted_at = pg_catalog.now(), updated_at = pg_catalog.now(),
        supabase_auth_id = p_supabase_auth_id
    WHERE id = invitation.tutor_invite_id
      AND (status = 'pending' OR (status = 'accepted' AND supabase_auth_id = p_supabase_auth_id));
  END IF;

  RETURN invitation;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_account_invitation(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_account_invitation(text, text, uuid) TO service_role;

-- DEV-AUTH-008, DEV-INV-001: issue (or replace) one durable invitation. For a
-- Tutor this writes the legacy tutor_invites listing row and the durable record
-- together, and revokes whatever pending pair existed before. For a Learner it
-- revokes the older pending link and marks the roster profile invited.
CREATE OR REPLACE FUNCTION public.issue_account_invitation(
  p_school_id uuid,
  p_invited_by uuid,
  p_role text,
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_student_profile_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  v_tutor_invite_id uuid;
  v_invitation_id uuid;
  v_student public.user_profiles%ROWTYPE;
BEGIN
  IF p_role NOT IN ('tutor', 'student') THEN RAISE EXCEPTION 'INVALID_INVITATION_ROLE'; END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'INVITATION_EMAIL_REQUIRED'; END IF;

  IF p_role = 'student' THEN
    SELECT * INTO v_student
    FROM public.user_profiles
    WHERE id = p_student_profile_id
      AND role = 'student'
      AND (
        school_id = p_school_id
        OR EXISTS (
          SELECT 1 FROM public.student_centre_memberships m
          WHERE m.student_id = p_student_profile_id AND m.school_id = p_school_id AND m.status = 'active'
        )
      )
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND'; END IF;
    IF v_student.onboarding_status = 'active' THEN RAISE EXCEPTION 'STUDENT_ACTIVE'; END IF;
    IF v_student.email IS NULL OR pg_catalog.lower(pg_catalog.btrim(v_student.email)) <> v_email THEN
      RAISE EXCEPTION 'INVITATION_EMAIL_MISMATCH';
    END IF;
  ELSE
    UPDATE public.tutor_invites
    SET status = CASE WHEN expires_at > pg_catalog.now() THEN 'revoked' ELSE 'expired' END,
        updated_at = pg_catalog.now()
    WHERE school_id = p_school_id AND email = v_email AND status = 'pending';
  END IF;

  UPDATE public.account_invitations
  SET status = 'revoked', updated_at = pg_catalog.now()
  WHERE school_id = p_school_id
    AND role = p_role
    AND pg_catalog.lower(email) = v_email
    AND status = 'pending';

  IF p_role = 'tutor' THEN
    INSERT INTO public.tutor_invites (school_id, email, invited_by, status, expires_at)
    VALUES (p_school_id, v_email, p_invited_by, 'pending', p_expires_at)
    RETURNING id INTO v_tutor_invite_id;
  END IF;

  INSERT INTO public.account_invitations
    (school_id, invited_by, role, email, token_hash, status, expires_at,
     student_profile_id, tutor_invite_id, metadata)
  VALUES
    (p_school_id, p_invited_by, p_role, v_email, p_token_hash, 'pending', p_expires_at,
     CASE WHEN p_role = 'student' THEN p_student_profile_id ELSE NULL END,
     v_tutor_invite_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_invitation_id;

  IF p_role = 'student' THEN
    UPDATE public.user_profiles SET onboarding_status = 'invited', updated_at = pg_catalog.now()
    WHERE id = p_student_profile_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'invitation_id', v_invitation_id,
    'tutor_invite_id', v_tutor_invite_id,
    'email', v_email,
    'expires_at', p_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_account_invitation(uuid, uuid, text, text, text, timestamptz, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_account_invitation(uuid, uuid, text, text, text, timestamptz, uuid, jsonb) TO service_role;

-- DEV-INV-002: conditional revoke of the legacy listing row and its durable
-- capability under one row lock. A concurrent acceptance either wins (status is
-- reported back) or loses (the link is revoked).
CREATE OR REPLACE FUNCTION public.revoke_tutor_invitation(
  p_school_id uuid,
  p_tutor_invite_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.tutor_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.tutor_invites
  WHERE id = p_tutor_invite_id AND school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('found', false);
  END IF;

  UPDATE public.account_invitations
  SET status = 'revoked', updated_at = pg_catalog.now()
  WHERE tutor_invite_id = v_invite.id AND status = 'pending';

  IF v_invite.status <> 'pending' THEN
    RETURN pg_catalog.jsonb_build_object('found', true, 'revoked', false, 'status', v_invite.status);
  END IF;

  UPDATE public.tutor_invites
  SET status = 'revoked', updated_at = pg_catalog.now()
  WHERE id = v_invite.id;

  RETURN pg_catalog.jsonb_build_object('found', true, 'revoked', true, 'status', 'revoked');
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_tutor_invitation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_tutor_invitation(uuid, uuid) TO service_role;

-- Cancel an unaccepted Learner invitation and its waiting class targets in one
-- transaction. (The previous route wrote status 'cancelled', which the
-- account_invitations check constraint rejects.)
CREATE OR REPLACE FUNCTION public.cancel_student_invitation(
  p_school_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student public.user_profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_student
  FROM public.user_profiles
  WHERE id = p_student_id
    AND role = 'student'
    AND (
      school_id = p_school_id
      OR EXISTS (
        SELECT 1 FROM public.student_centre_memberships m
        WHERE m.student_id = p_student_id AND m.school_id = p_school_id AND m.status = 'active'
      )
    )
  FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('found', false); END IF;
  IF v_student.onboarding_status = 'active' THEN
    RETURN pg_catalog.jsonb_build_object('found', true, 'cancelled', false, 'status', 'active');
  END IF;

  UPDATE public.account_invitations
  SET status = 'revoked', updated_at = pg_catalog.now()
  WHERE school_id = p_school_id AND student_profile_id = p_student_id AND status = 'pending';

  DELETE FROM public.pending_student_enrolments
  WHERE school_id = p_school_id AND student_profile_id = p_student_id;

  UPDATE public.user_profiles
  SET onboarding_status = 'not_invited', updated_at = pg_catalog.now()
  WHERE id = p_student_id;

  RETURN pg_catalog.jsonb_build_object('found', true, 'cancelled', true, 'status', 'not_invited');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_student_invitation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_student_invitation(uuid, uuid) TO service_role;

-- DEV-AUTH-006: record the provider result of an invitation start. The
-- invitation and the roster profile change together, so a failure cannot
-- leave one updated and the other not. Safe to repeat with the same auth id.
CREATE OR REPLACE FUNCTION public.record_invitation_start(
  p_invitation_id uuid,
  p_supabase_auth_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation public.account_invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_invitation
  FROM public.account_invitations
  WHERE id = p_invitation_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('recorded', false); END IF;

  UPDATE public.account_invitations
  SET supabase_auth_id = p_supabase_auth_id,
      auth_started_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = v_invitation.id;

  IF v_invitation.role = 'student' AND v_invitation.student_profile_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET supabase_auth_id = p_supabase_auth_id,
        onboarding_status = 'invited',
        updated_at = pg_catalog.now()
    WHERE id = v_invitation.student_profile_id
      AND onboarding_status <> 'active';
  END IF;

  RETURN pg_catalog.jsonb_build_object('recorded', true);
END;
$$;

REVOKE ALL ON FUNCTION public.record_invitation_start(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_invitation_start(uuid, uuid) TO service_role;

-- DEV-AUTH-004: consume the invitation and activate the Learner together.
CREATE OR REPLACE FUNCTION public.complete_student_invitation(
  p_token_hash text,
  p_email text,
  p_supabase_auth_id uuid,
  p_first_name text,
  p_last_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation public.account_invitations%ROWTYPE;
  v_profile public.user_profiles%ROWTYPE;
BEGIN
  v_invitation := public.consume_account_invitation(p_token_hash, p_email, p_supabase_auth_id);
  IF v_invitation.status <> 'accepted' THEN
    RETURN pg_catalog.jsonb_build_object('status', v_invitation.status);
  END IF;
  IF v_invitation.role <> 'student' OR v_invitation.student_profile_id IS NULL THEN
    RAISE EXCEPTION 'INVITATION_ROLE_MISMATCH';
  END IF;

  UPDATE public.user_profiles
  SET first_name = p_first_name,
      last_name = p_last_name,
      supabase_auth_id = p_supabase_auth_id,
      onboarding_status = 'active',
      activated_at = COALESCE(activated_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  WHERE id = v_invitation.student_profile_id AND role = 'student'
  RETURNING * INTO v_profile;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_PROFILE_MISMATCH'; END IF;

  RETURN pg_catalog.jsonb_build_object('status', 'accepted', 'profile', pg_catalog.to_jsonb(v_profile));
END;
$$;

REVOKE ALL ON FUNCTION public.complete_student_invitation(text, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_student_invitation(text, text, uuid, text, text) TO service_role;

-- DEV-AUTH-001, DEV-AUTH-003: consume the registration intent or tutor
-- invitation, allocate the Kanvise ID and insert the profile in one
-- transaction. Any failure rolls back the consumption. A unique violation on
-- supabase_auth_id propagates (SQLSTATE 23505) after rollback so the caller can
-- treat the request as a replay of an existing profile.
CREATE OR REPLACE FUNCTION public.register_user_profile(
  p_role text,
  p_supabase_auth_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_invitation_token_hash text DEFAULT NULL,
  p_intent_token_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation public.account_invitations%ROWTYPE;
  v_school_id uuid;
  v_profile public.user_profiles%ROWTYPE;
  v_next integer;
  v_code text;
  v_constraint text;
  v_attempt integer := 0;
BEGIN
  IF p_role NOT IN ('admin', 'tutor', 'student') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  v_code := CASE p_role WHEN 'admin' THEN 'ADM' WHEN 'tutor' THEN 'TUT' ELSE 'STU' END;

  IF p_invitation_token_hash IS NOT NULL THEN
    v_invitation := public.consume_account_invitation(p_invitation_token_hash, p_email, p_supabase_auth_id);
    IF v_invitation.status <> 'accepted' THEN
      RETURN pg_catalog.jsonb_build_object('status', v_invitation.status);
    END IF;
    IF v_invitation.role <> p_role THEN RAISE EXCEPTION 'INVITATION_ROLE_MISMATCH'; END IF;
    IF p_role = 'tutor' THEN v_school_id := v_invitation.school_id; END IF;
  END IF;

  IF p_role = 'tutor' AND v_school_id IS NULL THEN RAISE EXCEPTION 'TUTOR_INVITATION_REQUIRED'; END IF;

  IF p_intent_token_hash IS NOT NULL THEN
    UPDATE public.registration_intents
    SET consumed_at = pg_catalog.now(), consumed_by = p_supabase_auth_id
    WHERE token_hash = p_intent_token_hash
      AND kind = 'student'
      AND consumed_at IS NULL
      AND expires_at > pg_catalog.now();
    IF NOT FOUND THEN RAISE EXCEPTION 'REGISTRATION_INTENT_INVALID'; END IF;
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 10 THEN RAISE EXCEPTION 'ID_ALLOCATION_UNAVAILABLE'; END IF;
    v_next := public.increment_user_sequence(p_role);
    IF v_next IS NULL THEN RAISE EXCEPTION 'ID_ALLOCATION_UNAVAILABLE'; END IF;
    BEGIN
      INSERT INTO public.user_profiles
        (supabase_auth_id, role, school_id, kanvise_user_id, first_name, last_name, email)
      VALUES
        (p_supabase_auth_id, p_role, v_school_id,
         'KNV-' || v_code || '-' || pg_catalog.lpad(v_next::text, 5, '0'),
         p_first_name, p_last_name, p_email)
      RETURNING * INTO v_profile;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint IS NULL OR v_constraint NOT LIKE '%kanvise_user_id%' THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('status', 'created', 'profile', pg_catalog.to_jsonb(v_profile));
END;
$$;

REVOKE ALL ON FUNCTION public.register_user_profile(text, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_user_profile(text, uuid, text, text, text, text, text) TO service_role;

-- DEV-AUTH-009, DEV-USR-001, DEV-USR-002: stage the roster and class targets
-- for a validated batch. Each row runs in its own subtransaction, so one bad
-- row cannot abort or half-apply another, and re-running the same batch
-- converges on the same state (no duplicate profiles, enrolments or targets).
-- Invitation delivery is a separate, repeatable step in the API.
-- A Learner whose profile belongs to another account gets an active
-- student_centre_memberships row for this account instead of being rejected.
CREATE OR REPLACE FUNCTION public.import_roster_students(
  p_school_id uuid,
  p_invited_by uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row jsonb;
  v_results jsonb := '[]'::jsonb;
  v_index integer;
  v_email text;
  v_programme uuid;
  v_profile public.user_profiles%ROWTYPE;
  v_created boolean;
  v_enrolled boolean;
  v_pending boolean;
  v_next integer;
  v_inserted integer;
BEGIN
  IF p_rows IS NULL OR pg_catalog.jsonb_typeof(p_rows) <> 'array' OR pg_catalog.jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'INVALID_IMPORT_BATCH';
  END IF;

  FOR v_index IN 0 .. pg_catalog.jsonb_array_length(p_rows) - 1 LOOP
    v_row := p_rows -> v_index;
    v_created := false;
    v_enrolled := false;
    v_pending := false;
    BEGIN
      v_email := pg_catalog.lower(pg_catalog.btrim(v_row ->> 'email'));
      v_programme := NULLIF(v_row ->> 'programme_id', '')::uuid;
      IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'EMAIL_REQUIRED'; END IF;

      IF v_programme IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.programmes WHERE id = v_programme AND school_id = p_school_id
      ) THEN
        RAISE EXCEPTION 'PROGRAMME_NOT_FOUND';
      END IF;

      SELECT * INTO v_profile
      FROM public.user_profiles
      WHERE pg_catalog.lower(email) = v_email
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE;

      IF FOUND THEN
        IF v_profile.role <> 'student' OR v_profile.is_active IS NOT TRUE THEN RAISE EXCEPTION 'NOT_ELIGIBLE'; END IF;
        IF v_profile.school_id IS NULL THEN
          UPDATE public.user_profiles SET school_id = p_school_id, updated_at = pg_catalog.now()
          WHERE id = v_profile.id
          RETURNING * INTO v_profile;
        ELSIF v_profile.school_id <> p_school_id THEN
          INSERT INTO public.student_centre_memberships (student_id, school_id, status, source)
          VALUES (v_profile.id, p_school_id, 'active', 'admin_import')
          ON CONFLICT (student_id, school_id) DO UPDATE
            SET status = 'active', revoked_at = NULL, updated_at = pg_catalog.now()
            WHERE public.student_centre_memberships.status <> 'active';
        END IF;
      ELSE
        v_next := public.increment_user_sequence('student');
        IF v_next IS NULL THEN RAISE EXCEPTION 'ID_ALLOCATION_UNAVAILABLE'; END IF;
        INSERT INTO public.user_profiles
          (supabase_auth_id, school_id, role, kanvise_user_id, first_name, last_name, email, phone,
           onboarding_status, onboarding_source, added_by)
        VALUES
          (NULL, p_school_id, 'student', 'KNV-STU-' || pg_catalog.lpad(v_next::text, 5, '0'),
           COALESCE(v_row ->> 'first_name', ''), COALESCE(v_row ->> 'last_name', ''), v_email,
           NULLIF(v_row ->> 'phone', ''), 'not_invited', 'admin_import', p_invited_by)
        RETURNING * INTO v_profile;
        v_created := true;
      END IF;

      IF v_programme IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.enrolments
        WHERE school_id = p_school_id AND student_id = v_profile.id AND programme_id = v_programme
      ) THEN
        IF v_profile.onboarding_status = 'active' THEN
          INSERT INTO public.enrolments
            (school_id, student_id, programme_id, source, granted_by, imported_at)
          VALUES (p_school_id, v_profile.id, v_programme, 'admin_import', p_invited_by, pg_catalog.now());
          v_enrolled := true;
        ELSE
          INSERT INTO public.pending_student_enrolments
            (school_id, student_profile_id, programme_id, invited_by)
          VALUES (p_school_id, v_profile.id, v_programme, p_invited_by)
          ON CONFLICT (student_profile_id, programme_id) DO NOTHING;
          GET DIAGNOSTICS v_inserted = ROW_COUNT;
          v_pending := v_inserted > 0;
        END IF;
      END IF;

      v_results := v_results || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'row', COALESCE((v_row ->> 'row')::integer, v_index + 1),
        'ok', true,
        'student_profile_id', v_profile.id,
        'created', v_created,
        'enrolled', v_enrolled,
        'pending', v_pending,
        'onboarding_status', v_profile.onboarding_status,
        'first_name', v_profile.first_name,
        'last_name', v_profile.last_name
      ));
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'row', COALESCE((v_row ->> 'row')::integer, v_index + 1),
        'ok', false
      ));
    END;
  END LOOP;

  RETURN v_results;
END;
$$;

REVOKE ALL ON FUNCTION public.import_roster_students(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_roster_students(uuid, uuid, jsonb) TO service_role;

-- DEV-SCH-001: create the account and link its first Admin under a profile row
-- lock, so concurrent setup requests cannot orphan an account and a failed
-- link cannot leave an account behind.
CREATE OR REPLACE FUNCTION public.create_school_for_admin(
  p_admin_id uuid,
  p_name text,
  p_account_type text,
  p_slug text,
  p_description text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin public.user_profiles%ROWTYPE;
  v_school public.schools%ROWTYPE;
BEGIN
  SELECT * INTO v_admin
  FROM public.user_profiles
  WHERE id = p_admin_id
  FOR UPDATE;
  IF NOT FOUND OR v_admin.role <> 'admin' THEN RAISE EXCEPTION 'ADMIN_NOT_FOUND'; END IF;
  IF v_admin.school_id IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('already_configured', true);
  END IF;

  INSERT INTO public.schools (name, account_type, slug, description, contact_email, contact_phone)
  VALUES (p_name, p_account_type, p_slug, p_description, p_contact_email, p_contact_phone)
  RETURNING * INTO v_school;

  UPDATE public.user_profiles
  SET school_id = v_school.id, updated_at = pg_catalog.now()
  WHERE id = p_admin_id;

  RETURN pg_catalog.jsonb_build_object('already_configured', false, 'school', pg_catalog.to_jsonb(v_school));
END;
$$;

REVOKE ALL ON FUNCTION public.create_school_for_admin(uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_school_for_admin(uuid, text, text, text, text, text, text) TO service_role;
