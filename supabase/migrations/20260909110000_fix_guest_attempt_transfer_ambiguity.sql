-- Qualify guest ownership columns because the function's TABLE return columns
-- are also PL/pgSQL variables named attempt_id and entitlement_id.
CREATE OR REPLACE FUNCTION public.transfer_guest_mock_attempt(
  p_guest_id UUID, p_attempt_id UUID, p_student_id UUID, p_now TIMESTAMPTZ
)
RETURNS TABLE(attempt_id UUID, entitlement_id UUID, already_transferred BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_ownership public.guest_mock_attempts%ROWTYPE; v_attempt public.mock_attempts%ROWTYPE;
  v_guest public.guest_mock_learners%ROWTYPE; v_offer public.mock_access_offers%ROWTYPE;
  v_entitlement public.mock_entitlements%ROWTYPE; v_attempt_number INTEGER;
BEGIN
  SELECT ownership.* INTO v_ownership FROM public.guest_mock_attempts ownership
  WHERE ownership.guest_id = p_guest_id AND ownership.attempt_id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GUEST_ATTEMPT_NOT_FOUND'; END IF;

  SELECT attempt.* INTO v_attempt FROM public.mock_attempts attempt
  WHERE attempt.id = p_attempt_id FOR UPDATE;
  IF v_ownership.transferred_at IS NOT NULL THEN
    IF v_ownership.transferred_to <> p_student_id THEN RAISE EXCEPTION 'GUEST_ATTEMPT_ALREADY_CLAIMED'; END IF;
    RETURN QUERY SELECT v_attempt.id, v_attempt.entitlement_id, true;
    RETURN;
  END IF;

  SELECT guest.* INTO v_guest FROM public.guest_mock_learners guest
  WHERE guest.id = p_guest_id AND guest.claimed_at IS NULL AND guest.expires_at > p_now FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GUEST_ATTEMPT_NOT_FOUND'; END IF;

  SELECT offer.* INTO v_offer FROM public.mock_access_offers offer
  WHERE offer.id = v_ownership.offer_id FOR SHARE;
  IF NOT FOUND OR v_offer.audience_scope <> 'public_link' OR v_offer.access_mode <> 'free_claim'
    THEN RAISE EXCEPTION 'GUEST_MOCK_NOT_AVAILABLE'; END IF;

  SELECT entitlement.* INTO v_entitlement FROM public.mock_entitlements entitlement
  WHERE entitlement.student_id = p_student_id AND entitlement.offer_id = v_offer.id
    AND entitlement.mock_exam_version_id = v_offer.mock_exam_version_id
    AND entitlement.revoked_at IS NULL FOR UPDATE;
  IF FOUND AND v_entitlement.expires_at IS NOT NULL AND v_entitlement.expires_at <= p_now
    THEN RAISE EXCEPTION 'ENTITLEMENT_EXPIRED'; END IF;
  IF NOT FOUND THEN
    INSERT INTO public.mock_entitlements(student_id, offer_id, mock_exam_version_id, source, attempts_granted, expires_at)
    VALUES (p_student_id, v_offer.id, v_offer.mock_exam_version_id, 'free_claim', v_offer.attempts_included,
      CASE WHEN v_offer.expires_after_days IS NULL THEN NULL ELSE p_now + make_interval(days => v_offer.expires_after_days) END)
    RETURNING * INTO v_entitlement;
  END IF;
  IF v_entitlement.attempts_consumed >= v_entitlement.attempts_granted THEN RAISE EXCEPTION 'ATTEMPT_LIMIT_REACHED'; END IF;
  IF EXISTS (SELECT 1 FROM public.mock_attempts attempt WHERE attempt.student_id = p_student_id
    AND attempt.mock_exam_version_id = v_offer.mock_exam_version_id AND attempt.status = 'in_progress')
    THEN RAISE EXCEPTION 'STUDENT_ATTEMPT_IN_PROGRESS'; END IF;

  SELECT COALESCE(max(attempt.attempt_number), 0) + 1 INTO v_attempt_number
  FROM public.mock_attempts attempt
  WHERE attempt.student_id = p_student_id AND attempt.mock_exam_version_id = v_offer.mock_exam_version_id;
  UPDATE public.mock_attempts attempt SET student_id = p_student_id, entitlement_id = v_entitlement.id,
    access_source = 'entitlement', attempt_number = v_attempt_number WHERE attempt.id = p_attempt_id;
  UPDATE public.mock_entitlements entitlement SET attempts_consumed = entitlement.attempts_consumed + 1
    WHERE entitlement.id = v_entitlement.id;
  UPDATE public.guest_mock_attempts ownership SET transferred_at = p_now, transferred_to = p_student_id
    WHERE ownership.id = v_ownership.id;
  UPDATE public.guest_mock_learners guest SET claimed_at = p_now, claimed_by = p_student_id, last_seen_at = p_now
    WHERE guest.id = p_guest_id AND NOT EXISTS (
      SELECT 1 FROM public.guest_mock_attempts ownership
      WHERE ownership.guest_id = p_guest_id AND ownership.transferred_at IS NULL
    );
  RETURN QUERY SELECT p_attempt_id, v_entitlement.id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_guest_mock_attempt(UUID, UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_guest_mock_attempt(UUID, UUID, UUID, TIMESTAMPTZ)
  TO service_role;
