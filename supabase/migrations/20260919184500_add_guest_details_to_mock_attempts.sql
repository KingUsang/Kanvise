ALTER TABLE public.mock_attempts
ADD COLUMN IF NOT EXISTS guest_name TEXT,
ADD COLUMN IF NOT EXISTS guest_email TEXT,
ADD COLUMN IF NOT EXISTS guest_phone TEXT;

CREATE OR REPLACE FUNCTION public.submit_guest_mock_attempt(
  p_guest_id UUID, p_attempt_id UUID, p_now TIMESTAMPTZ, p_reason TEXT,
  p_guest_name TEXT DEFAULT NULL, p_guest_email TEXT DEFAULT NULL, p_guest_phone TEXT DEFAULT NULL
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
  
  IF p_guest_name IS NOT NULL OR p_guest_email IS NOT NULL OR p_guest_phone IS NOT NULL THEN
    UPDATE public.mock_attempts SET 
      guest_name = COALESCE(p_guest_name, guest_name),
      guest_email = COALESCE(p_guest_email, guest_email),
      guest_phone = COALESCE(p_guest_phone, guest_phone)
    WHERE id = p_attempt_id;
  END IF;

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
