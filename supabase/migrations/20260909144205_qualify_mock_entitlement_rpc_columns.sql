-- RETURNS TABLE names become PL/pgSQL variables. Qualify table columns so
-- payment confirmation and purchased-attempt startup cannot fail at runtime
-- with PostgreSQL 42702 (ambiguous_column).
CREATE OR REPLACE FUNCTION public.start_or_resume_mock_offer_attempt(
  p_offer_id UUID, p_student_id UUID, p_now TIMESTAMPTZ
)
RETURNS TABLE(attempt_id UUID, mock_exam_version_id UUID, attempt_number INTEGER, started_at TIMESTAMPTZ, deadline_at TIMESTAMPTZ, resumed BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_offer public.mock_access_offers%ROWTYPE; v_entitlement public.mock_entitlements%ROWTYPE;
  v_mock public.mock_exams%ROWTYPE; v_attempt public.mock_attempts%ROWTYPE; v_deadline TIMESTAMPTZ;
BEGIN
  SELECT offer.* INTO v_offer FROM public.mock_access_offers offer WHERE offer.id = p_offer_id FOR SHARE;
  IF NOT FOUND OR NOT v_offer.is_active OR (v_offer.available_from IS NOT NULL AND p_now < v_offer.available_from)
    OR (v_offer.closes_at IS NOT NULL AND p_now >= v_offer.closes_at) THEN RAISE EXCEPTION 'MOCK_OFFER_NOT_AVAILABLE'; END IF;
  SELECT entitlement.* INTO v_entitlement FROM public.mock_entitlements entitlement
    WHERE entitlement.student_id = p_student_id AND entitlement.offer_id = p_offer_id
      AND entitlement.mock_exam_version_id = v_offer.mock_exam_version_id
      AND entitlement.revoked_at IS NULL
      AND (entitlement.expires_at IS NULL OR entitlement.expires_at > p_now)
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_ENTITLEMENT_NOT_FOUND'; END IF;
  SELECT exam.* INTO v_mock FROM public.mock_exams exam WHERE exam.id = v_offer.mock_exam_id AND exam.school_id = v_offer.school_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_NOT_AVAILABLE'; END IF;
  SELECT attempt.* INTO v_attempt FROM public.mock_attempts attempt
    WHERE attempt.entitlement_id = v_entitlement.id AND attempt.status = 'in_progress'
    ORDER BY attempt.attempt_number DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF v_attempt.deadline_at IS NULL OR p_now < v_attempt.deadline_at THEN
      RETURN QUERY SELECT v_attempt.id, v_offer.mock_exam_version_id, v_attempt.attempt_number, v_attempt.started_at, v_attempt.deadline_at, true; RETURN;
    END IF;
    RAISE EXCEPTION 'ATTEMPT_EXPIRED';
  END IF;
  IF v_entitlement.attempts_consumed >= v_entitlement.attempts_granted THEN RAISE EXCEPTION 'ATTEMPT_LIMIT_REACHED'; END IF;
  v_deadline := CASE WHEN COALESCE(v_mock.time_limit_minutes, 0) > 0 THEN p_now + make_interval(mins => v_mock.time_limit_minutes) ELSE NULL END;
  IF v_offer.closes_at IS NOT NULL AND (v_deadline IS NULL OR v_offer.closes_at < v_deadline) THEN v_deadline := v_offer.closes_at; END IF;
  INSERT INTO public.mock_attempts(school_id, mock_exam_id, mock_exam_version_id, student_id, entitlement_id, access_source,
    attempt_number, started_at, deadline_at, last_saved_at, status, total_mcq_questions, total_marks)
  VALUES (v_offer.school_id, v_offer.mock_exam_id, v_offer.mock_exam_version_id, p_student_id, v_entitlement.id, 'entitlement',
    v_entitlement.attempts_consumed + 1, p_now, v_deadline, p_now, 'in_progress',
    (SELECT count(*) FROM public.mock_version_questions mvq JOIN public.bank_question_versions bqv ON bqv.id = mvq.question_version_id
      JOIN public.bank_questions bq ON bq.id = bqv.question_id WHERE mvq.mock_exam_version_id = v_offer.mock_exam_version_id AND bq.question_type = 'mcq'),
    (SELECT version.total_marks FROM public.mock_exam_versions version WHERE version.id = v_offer.mock_exam_version_id)) RETURNING * INTO v_attempt;
  UPDATE public.mock_entitlements entitlement
    SET attempts_consumed = entitlement.attempts_consumed + 1
    WHERE entitlement.id = v_entitlement.id;
  RETURN QUERY SELECT v_attempt.id, v_offer.mock_exam_version_id, v_attempt.attempt_number, v_attempt.started_at, v_attempt.deadline_at, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_mock_order_payment(
  p_paystack_reference TEXT, p_paystack_transaction_id TEXT, p_amount_kobo INTEGER, p_now TIMESTAMPTZ
)
RETURNS TABLE(order_id UUID, entitlement_id UUID, already_processed BOOLEAN, student_id UUID, student_email TEXT, student_first_name TEXT, offer_title TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_order public.mock_orders%ROWTYPE; v_offer public.mock_access_offers%ROWTYPE; v_entitlement public.mock_entitlements%ROWTYPE; v_has_entitlement BOOLEAN := false;
BEGIN
  SELECT orders.* INTO v_order FROM public.mock_orders orders WHERE orders.paystack_reference = p_paystack_reference FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_ORDER_NOT_FOUND'; END IF;
  IF v_order.amount_kobo <> p_amount_kobo THEN RAISE EXCEPTION 'MOCK_ORDER_AMOUNT_MISMATCH'; END IF;
  SELECT offer.* INTO v_offer FROM public.mock_access_offers offer WHERE offer.id = v_order.offer_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_OFFER_NOT_FOUND'; END IF;
  SELECT entitlement.* INTO v_entitlement FROM public.mock_entitlements entitlement
    WHERE entitlement.student_id = v_order.student_id
      AND entitlement.offer_id = v_order.offer_id
      AND entitlement.mock_exam_version_id = v_order.mock_exam_version_id
      AND entitlement.revoked_at IS NULL
    FOR UPDATE;
  v_has_entitlement := FOUND;
  IF v_order.status = 'paid' THEN
    RETURN QUERY SELECT v_order.id, v_entitlement.id, true, v_order.student_id, profile.email, profile.first_name, mock.title
    FROM public.user_profiles profile JOIN public.mock_exams mock ON mock.id = v_offer.mock_exam_id WHERE profile.id = v_order.student_id; RETURN;
  END IF;
  UPDATE public.mock_orders orders
    SET status = 'paid', paystack_transaction_id = p_paystack_transaction_id, paid_at = p_now, updated_at = p_now
    WHERE orders.id = v_order.id;
  IF NOT v_has_entitlement THEN
    INSERT INTO public.mock_entitlements(student_id, offer_id, mock_exam_version_id, source, order_id, attempts_granted, expires_at)
    VALUES (v_order.student_id, v_order.offer_id, v_order.mock_exam_version_id, 'purchase', v_order.id, v_offer.attempts_included,
      CASE WHEN v_offer.expires_after_days IS NULL THEN NULL ELSE p_now + make_interval(days => v_offer.expires_after_days) END)
    RETURNING * INTO v_entitlement;
  END IF;
  RETURN QUERY SELECT v_order.id, v_entitlement.id, false, v_order.student_id, profile.email, profile.first_name, mock.title
  FROM public.user_profiles profile JOIN public.mock_exams mock ON mock.id = v_offer.mock_exam_id WHERE profile.id = v_order.student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_or_resume_mock_offer_attempt(UUID, UUID, TIMESTAMPTZ), public.confirm_mock_order_payment(TEXT, TEXT, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_or_resume_mock_offer_attempt(UUID, UUID, TIMESTAMPTZ), public.confirm_mock_order_payment(TEXT, TEXT, INTEGER, TIMESTAMPTZ) TO service_role;
