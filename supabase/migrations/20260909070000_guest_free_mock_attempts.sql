-- Free public mocks may be attempted without creating a Kanvise identity.
-- Guest ownership is an opaque server-issued cookie whose hash alone is stored.
-- It never creates a user_profile, centre membership, enrolment, or Auth user.

ALTER TABLE public.mock_attempts ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.mock_attempts DROP CONSTRAINT IF EXISTS mock_attempts_access_source_check;
ALTER TABLE public.mock_attempts ADD CONSTRAINT mock_attempts_access_source_check
  CHECK (access_source IN ('included', 'entitlement', 'guest'));

CREATE TABLE public.guest_mock_learners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  claimed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  CONSTRAINT guest_mock_learners_claim_check CHECK (
    (claimed_by IS NULL AND claimed_at IS NULL) OR (claimed_by IS NOT NULL AND claimed_at IS NOT NULL)
  )
);

CREATE TABLE public.guest_mock_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  guest_id UUID NOT NULL REFERENCES public.guest_mock_learners(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES public.mock_access_offers(id) ON DELETE RESTRICT,
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.mock_attempts(id) ON DELETE CASCADE,
  transferred_at TIMESTAMPTZ,
  transferred_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  UNIQUE (guest_id, offer_id),
  CONSTRAINT guest_mock_attempts_transfer_check CHECK (
    (transferred_at IS NULL AND transferred_to IS NULL) OR (transferred_at IS NOT NULL AND transferred_to IS NOT NULL)
  )
);

CREATE INDEX idx_guest_mock_attempts_guest ON public.guest_mock_attempts(guest_id, transferred_at);
CREATE TABLE public.guest_mock_start_limits (
  fingerprint_hash TEXT NOT NULL CHECK (length(fingerprint_hash) = 64),
  window_start TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  PRIMARY KEY (fingerprint_hash, window_start)
);
ALTER TABLE public.guest_mock_learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_mock_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_mock_start_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guest_mock_learners, public.guest_mock_attempts, public.guest_mock_start_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guest_mock_learners, public.guest_mock_attempts, public.guest_mock_start_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_guest_mock_start_limit(
  p_fingerprint_hash TEXT, p_now TIMESTAMPTZ, p_max_attempts INTEGER DEFAULT 12
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_window TIMESTAMPTZ := date_trunc('hour', p_now); v_attempts INTEGER;
BEGIN
  INSERT INTO public.guest_mock_start_limits(fingerprint_hash, window_start, attempts)
  VALUES (p_fingerprint_hash, v_window, 1)
  ON CONFLICT (fingerprint_hash, window_start) DO UPDATE
    SET attempts = public.guest_mock_start_limits.attempts + 1
  RETURNING attempts INTO v_attempts;
  RETURN v_attempts <= p_max_attempts;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_or_resume_guest_mock_attempt(
  p_guest_id UUID, p_offer_id UUID, p_now TIMESTAMPTZ
)
RETURNS TABLE(attempt_id UUID, mock_exam_version_id UUID, started_at TIMESTAMPTZ, deadline_at TIMESTAMPTZ, resumed BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_guest public.guest_mock_learners%ROWTYPE;
  v_offer public.mock_access_offers%ROWTYPE;
  v_mock public.mock_exams%ROWTYPE;
  v_attempt public.mock_attempts%ROWTYPE;
  v_deadline TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_guest FROM public.guest_mock_learners
    WHERE id = p_guest_id AND claimed_at IS NULL AND expires_at > p_now FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GUEST_SESSION_NOT_FOUND'; END IF;

  SELECT * INTO v_offer FROM public.mock_access_offers WHERE id = p_offer_id FOR SHARE;
  IF NOT FOUND OR NOT v_offer.is_active OR v_offer.audience_scope <> 'public_link'
    OR v_offer.access_mode <> 'free_claim'
    OR (v_offer.available_from IS NOT NULL AND p_now < v_offer.available_from)
    OR (v_offer.closes_at IS NOT NULL AND p_now >= v_offer.closes_at)
  THEN RAISE EXCEPTION 'GUEST_MOCK_NOT_AVAILABLE'; END IF;

  SELECT * INTO v_mock FROM public.mock_exams
    WHERE id = v_offer.mock_exam_id AND school_id = v_offer.school_id AND delivery_mode = 'fixed';
  IF NOT FOUND THEN RAISE EXCEPTION 'GUEST_MOCK_NOT_AVAILABLE'; END IF;

  SELECT attempt.* INTO v_attempt
  FROM public.guest_mock_attempts ownership
  JOIN public.mock_attempts attempt ON attempt.id = ownership.attempt_id
  WHERE ownership.guest_id = p_guest_id AND ownership.offer_id = p_offer_id
    AND ownership.transferred_at IS NULL FOR UPDATE OF ownership, attempt;
  IF FOUND THEN
    IF v_attempt.status <> 'in_progress' THEN RAISE EXCEPTION 'GUEST_ATTEMPT_ALREADY_USED'; END IF;
    IF v_attempt.deadline_at IS NOT NULL AND p_now >= v_attempt.deadline_at THEN RAISE EXCEPTION 'ATTEMPT_EXPIRED'; END IF;
    UPDATE public.guest_mock_learners SET last_seen_at = p_now WHERE id = p_guest_id;
    RETURN QUERY SELECT v_attempt.id, v_attempt.mock_exam_version_id, v_attempt.started_at, v_attempt.deadline_at, true;
    RETURN;
  END IF;

  v_deadline := CASE WHEN COALESCE(v_mock.time_limit_minutes, 0) > 0
    THEN p_now + make_interval(mins => v_mock.time_limit_minutes) ELSE NULL END;
  IF v_offer.closes_at IS NOT NULL AND (v_deadline IS NULL OR v_offer.closes_at < v_deadline) THEN
    v_deadline := v_offer.closes_at;
  END IF;

  INSERT INTO public.mock_attempts(
    school_id, mock_exam_id, mock_exam_version_id, student_id, entitlement_id, access_source,
    attempt_number, started_at, deadline_at, last_saved_at, status, total_mcq_questions, total_marks
  ) VALUES (
    v_offer.school_id, v_offer.mock_exam_id, v_offer.mock_exam_version_id, NULL, NULL, 'guest',
    1, p_now, v_deadline, p_now, 'in_progress', 0, 0
  ) RETURNING * INTO v_attempt;
  INSERT INTO public.guest_mock_attempts(guest_id, offer_id, attempt_id)
    VALUES (p_guest_id, p_offer_id, v_attempt.id);
  UPDATE public.guest_mock_learners SET last_seen_at = p_now WHERE id = p_guest_id;
  RETURN QUERY SELECT v_attempt.id, v_attempt.mock_exam_version_id, v_attempt.started_at, v_attempt.deadline_at, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_guest_mock_answer(
  p_guest_id UUID, p_attempt_id UUID, p_mock_version_question_id UUID,
  p_selected_option_version_id UUID, p_theory_answer_text TEXT, p_is_flagged BOOLEAN, p_now TIMESTAMPTZ
)
RETURNS TABLE(answer_id UUID, saved_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_attempt public.mock_attempts%ROWTYPE; v_question RECORD; v_answer public.mock_answers%ROWTYPE;
BEGIN
  SELECT attempt.* INTO v_attempt FROM public.guest_mock_attempts ownership
  JOIN public.guest_mock_learners guest ON guest.id = ownership.guest_id
  JOIN public.mock_attempts attempt ON attempt.id = ownership.attempt_id
  WHERE ownership.guest_id = p_guest_id AND ownership.attempt_id = p_attempt_id
    AND ownership.transferred_at IS NULL AND guest.claimed_at IS NULL AND guest.expires_at > p_now
  FOR UPDATE OF ownership, guest, attempt;
  IF NOT FOUND THEN RAISE EXCEPTION 'GUEST_ATTEMPT_NOT_FOUND'; END IF;
  IF v_attempt.status <> 'in_progress' THEN RAISE EXCEPTION 'ATTEMPT_FINALIZED'; END IF;
  IF v_attempt.deadline_at IS NOT NULL AND p_now >= v_attempt.deadline_at THEN RAISE EXCEPTION 'ATTEMPT_EXPIRED'; END IF;

  SELECT question.id, bank_question.question_type, question_version.id AS question_version_id INTO v_question
  FROM public.mock_attempt_questions snapshot
  JOIN public.mock_version_questions question ON question.id = snapshot.mock_version_question_id
  JOIN public.bank_question_versions question_version ON question_version.id = question.question_version_id
  JOIN public.bank_questions bank_question ON bank_question.id = question_version.question_id
  WHERE snapshot.attempt_id = p_attempt_id AND question.id = p_mock_version_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ATTEMPT_QUESTION_NOT_FOUND'; END IF;
  IF v_question.question_type = 'mcq' THEN
    IF p_theory_answer_text IS NOT NULL THEN RAISE EXCEPTION 'MCQ_THEORY_ANSWER_INVALID'; END IF;
    IF p_selected_option_version_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.bank_question_option_versions option
      WHERE option.id = p_selected_option_version_id AND option.question_version_id = v_question.question_version_id
        AND option.school_id = v_attempt.school_id
    ) THEN RAISE EXCEPTION 'OPTION_NOT_FOUND'; END IF;
  ELSIF p_selected_option_version_id IS NOT NULL THEN RAISE EXCEPTION 'THEORY_OPTION_INVALID'; END IF;

  INSERT INTO public.mock_answers(
    school_id, attempt_id, mock_version_question_id, selected_option_version_id, theory_answer_text, is_flagged, saved_at
  ) VALUES (
    v_attempt.school_id, p_attempt_id, p_mock_version_question_id, p_selected_option_version_id,
    NULLIF(p_theory_answer_text, ''), COALESCE(p_is_flagged, false), p_now
  ) ON CONFLICT (attempt_id, mock_version_question_id) WHERE mock_version_question_id IS NOT NULL
  DO UPDATE SET selected_option_version_id = EXCLUDED.selected_option_version_id,
    theory_answer_text = EXCLUDED.theory_answer_text, is_flagged = EXCLUDED.is_flagged, saved_at = EXCLUDED.saved_at
  RETURNING * INTO v_answer;
  UPDATE public.mock_attempts SET last_saved_at = p_now WHERE id = p_attempt_id;
  UPDATE public.guest_mock_learners SET last_seen_at = p_now WHERE id = p_guest_id;
  RETURN QUERY SELECT v_answer.id, v_answer.saved_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_guest_mock_attempt(
  p_guest_id UUID, p_attempt_id UUID, p_now TIMESTAMPTZ, p_reason TEXT
)
RETURNS TABLE(status TEXT, mcq_score NUMERIC, total_score NUMERIC, total_marks NUMERIC, submitted_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_attempt public.mock_attempts%ROWTYPE; v_mcq_score NUMERIC; v_total_score NUMERIC;
  v_total_marks NUMERIC; v_correct INTEGER; v_status TEXT; v_reason TEXT;
BEGIN
  SELECT attempt.* INTO v_attempt FROM public.guest_mock_attempts ownership
  JOIN public.guest_mock_learners guest ON guest.id = ownership.guest_id
  JOIN public.mock_attempts attempt ON attempt.id = ownership.attempt_id
  WHERE ownership.guest_id = p_guest_id AND ownership.attempt_id = p_attempt_id
    AND ownership.transferred_at IS NULL AND guest.claimed_at IS NULL AND guest.expires_at > p_now
  FOR UPDATE OF ownership, guest, attempt;
  IF NOT FOUND THEN RAISE EXCEPTION 'GUEST_ATTEMPT_NOT_FOUND'; END IF;
  IF v_attempt.status <> 'in_progress' THEN
    RETURN QUERY SELECT v_attempt.status, v_attempt.mcq_score, v_attempt.total_score, v_attempt.total_marks, v_attempt.submitted_at;
    RETURN;
  END IF;
  v_reason := CASE WHEN v_attempt.deadline_at IS NOT NULL AND p_now >= v_attempt.deadline_at
    THEN 'timeout' ELSE COALESCE(p_reason, 'student') END;
  IF v_reason NOT IN ('student', 'timeout') THEN RAISE EXCEPTION 'INVALID_SUBMISSION_REASON'; END IF;
  v_status := CASE WHEN v_reason = 'timeout' THEN 'timed_out' ELSE 'submitted' END;

  UPDATE public.mock_answers answer SET is_correct = (
    SELECT option.is_correct FROM public.mock_version_questions question
    JOIN public.bank_question_versions question_version ON question_version.id = question.question_version_id
    JOIN public.bank_questions bank_question ON bank_question.id = question_version.question_id AND bank_question.question_type = 'mcq'
    LEFT JOIN public.bank_question_option_versions option ON option.id = answer.selected_option_version_id
      AND option.question_version_id = question_version.id
    WHERE question.id = answer.mock_version_question_id
  ) WHERE answer.attempt_id = p_attempt_id;
  SELECT COALESCE(sum(CASE WHEN answer.is_correct THEN question.marks ELSE 0 END), 0),
    (count(*) FILTER (WHERE answer.is_correct))::INTEGER INTO v_mcq_score, v_correct
  FROM public.mock_attempt_questions snapshot
  JOIN public.mock_version_questions question ON question.id = snapshot.mock_version_question_id
  JOIN public.bank_question_versions question_version ON question_version.id = question.question_version_id
  JOIN public.bank_questions bank_question ON bank_question.id = question_version.question_id AND bank_question.question_type = 'mcq'
  LEFT JOIN public.mock_answers answer ON answer.attempt_id = p_attempt_id AND answer.mock_version_question_id = question.id
  WHERE snapshot.attempt_id = p_attempt_id;
  SELECT COALESCE(sum(question.marks), 0) INTO v_total_marks FROM public.mock_attempt_questions snapshot
    JOIN public.mock_version_questions question ON question.id = snapshot.mock_version_question_id
    WHERE snapshot.attempt_id = p_attempt_id;
  v_total_score := v_mcq_score + COALESCE(v_attempt.theory_score, 0);
  UPDATE public.mock_attempts SET status = v_status, submitted_at = p_now, finalized_at = p_now,
    submission_reason = v_reason, mcq_score = v_mcq_score, correct_mcq_answers = v_correct,
    total_score = v_total_score, total_marks = v_total_marks, last_saved_at = p_now
    WHERE id = p_attempt_id RETURNING * INTO v_attempt;
  UPDATE public.guest_mock_learners SET last_seen_at = p_now WHERE id = p_guest_id;
  RETURN QUERY SELECT v_attempt.status, v_attempt.mcq_score, v_attempt.total_score, v_attempt.total_marks, v_attempt.submitted_at;
END;
$$;

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
  SELECT * INTO v_ownership FROM public.guest_mock_attempts
  WHERE guest_id = p_guest_id AND attempt_id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GUEST_ATTEMPT_NOT_FOUND'; END IF;
  SELECT * INTO v_attempt FROM public.mock_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF v_ownership.transferred_at IS NOT NULL THEN
    IF v_ownership.transferred_to <> p_student_id THEN RAISE EXCEPTION 'GUEST_ATTEMPT_ALREADY_CLAIMED'; END IF;
    RETURN QUERY SELECT v_attempt.id, v_attempt.entitlement_id, true; RETURN;
  END IF;
  SELECT * INTO v_guest FROM public.guest_mock_learners
  WHERE id = p_guest_id AND claimed_at IS NULL AND expires_at > p_now FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GUEST_ATTEMPT_NOT_FOUND'; END IF;
  SELECT * INTO v_offer FROM public.mock_access_offers WHERE id = v_ownership.offer_id FOR SHARE;
  IF NOT FOUND OR v_offer.audience_scope <> 'public_link' OR v_offer.access_mode <> 'free_claim'
    THEN RAISE EXCEPTION 'GUEST_MOCK_NOT_AVAILABLE'; END IF;

  SELECT * INTO v_entitlement FROM public.mock_entitlements
    WHERE student_id = p_student_id AND offer_id = v_offer.id AND mock_exam_version_id = v_offer.mock_exam_version_id
      AND revoked_at IS NULL FOR UPDATE;
  IF FOUND AND v_entitlement.expires_at IS NOT NULL AND v_entitlement.expires_at <= p_now
    THEN RAISE EXCEPTION 'ENTITLEMENT_EXPIRED'; END IF;
  IF NOT FOUND THEN
    INSERT INTO public.mock_entitlements(student_id, offer_id, mock_exam_version_id, source, attempts_granted, expires_at)
    VALUES (p_student_id, v_offer.id, v_offer.mock_exam_version_id, 'free_claim', v_offer.attempts_included,
      CASE WHEN v_offer.expires_after_days IS NULL THEN NULL ELSE p_now + make_interval(days => v_offer.expires_after_days) END)
    RETURNING * INTO v_entitlement;
  END IF;
  IF v_entitlement.attempts_consumed >= v_entitlement.attempts_granted THEN RAISE EXCEPTION 'ATTEMPT_LIMIT_REACHED'; END IF;
  IF EXISTS (SELECT 1 FROM public.mock_attempts WHERE student_id = p_student_id
    AND mock_exam_version_id = v_offer.mock_exam_version_id AND status = 'in_progress')
    THEN RAISE EXCEPTION 'STUDENT_ATTEMPT_IN_PROGRESS'; END IF;
  SELECT COALESCE(max(attempt_number), 0) + 1 INTO v_attempt_number FROM public.mock_attempts
    WHERE student_id = p_student_id AND mock_exam_version_id = v_offer.mock_exam_version_id;
  UPDATE public.mock_attempts SET student_id = p_student_id, entitlement_id = v_entitlement.id,
    access_source = 'entitlement', attempt_number = v_attempt_number WHERE id = p_attempt_id;
  UPDATE public.mock_entitlements SET attempts_consumed = attempts_consumed + 1 WHERE id = v_entitlement.id;
  UPDATE public.guest_mock_attempts SET transferred_at = p_now, transferred_to = p_student_id WHERE id = v_ownership.id;
  UPDATE public.guest_mock_learners SET claimed_at = p_now, claimed_by = p_student_id, last_seen_at = p_now
    WHERE id = p_guest_id AND NOT EXISTS (
      SELECT 1 FROM public.guest_mock_attempts WHERE guest_id = p_guest_id AND transferred_at IS NULL
    );
  RETURN QUERY SELECT p_attempt_id, v_entitlement.id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.start_or_resume_guest_mock_attempt(UUID, UUID, TIMESTAMPTZ),
  public.save_guest_mock_answer(UUID, UUID, UUID, UUID, TEXT, BOOLEAN, TIMESTAMPTZ),
  public.submit_guest_mock_attempt(UUID, UUID, TIMESTAMPTZ, TEXT),
  public.transfer_guest_mock_attempt(UUID, UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_guest_mock_start_limit(TEXT, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_or_resume_guest_mock_attempt(UUID, UUID, TIMESTAMPTZ),
  public.save_guest_mock_answer(UUID, UUID, UUID, UUID, TEXT, BOOLEAN, TIMESTAMPTZ),
  public.submit_guest_mock_attempt(UUID, UUID, TIMESTAMPTZ, TEXT),
  public.transfer_guest_mock_attempt(UUID, UUID, UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_guest_mock_start_limit(TEXT, TIMESTAMPTZ, INTEGER) TO service_role;
