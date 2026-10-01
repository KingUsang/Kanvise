-- A public multi-subject mock is not tied to a centre programme. The learner
-- chooses the named sections they intend to sit and that choice is frozen on
-- the attempt before any question can be opened.
ALTER TABLE public.mock_attempts
  ADD COLUMN selected_subject_names TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

COMMENT ON COLUMN public.mock_attempts.selected_subject_names IS
  'Named sections selected for a public subject-combination attempt. Empty for fixed and programme-derived attempts.';

CREATE OR REPLACE FUNCTION public.snapshot_mock_attempt_questions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  delivery TEXT;
  target_programme UUID;
  target_audience TEXT;
  selected_count INTEGER;
  inserted_count INTEGER;
BEGIN
  SELECT mock.delivery_mode, mock.programme_id, mock.audience_scope
    INTO delivery, target_programme, target_audience
  FROM public.mock_exams mock
  WHERE mock.id = NEW.mock_exam_id AND mock.school_id = NEW.school_id;

  IF delivery = 'subject_combination' THEN
    -- Paid/public-account attempts can supply a deliberate selection. Guest
    -- free attempts keep the existing full-paper behaviour until that flow
    -- receives its own subject picker.
    IF target_audience = 'direct_link' AND NEW.access_source = 'entitlement' THEN
      SELECT cardinality(NEW.selected_subject_names) INTO selected_count;
      IF selected_count IS NULL OR selected_count = 0 THEN
        RAISE EXCEPTION 'SUBJECT_SELECTION_REQUIRED';
      END IF;
      IF selected_count <> (SELECT count(DISTINCT item) FROM unnest(NEW.selected_subject_names) AS item) THEN
        RAISE EXCEPTION 'SUBJECT_SELECTION_DUPLICATE';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM unnest(NEW.selected_subject_names) AS selection(subject_name)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.mock_version_questions question
          WHERE question.mock_exam_version_id = NEW.mock_exam_version_id
            AND question.school_id = NEW.school_id
            AND question.section_title = selection.subject_name
        )
      ) THEN
        RAISE EXCEPTION 'SUBJECT_SELECTION_INVALID';
      END IF;

      INSERT INTO public.mock_attempt_questions (school_id, attempt_id, mock_version_question_id)
      SELECT NEW.school_id, NEW.id, question.id
      FROM public.mock_version_questions question
      WHERE question.school_id = NEW.school_id
        AND question.mock_exam_version_id = NEW.mock_exam_version_id
        AND question.section_title = ANY(NEW.selected_subject_names);
    ELSE
      IF target_programme IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.enrolments enrolment
        WHERE enrolment.school_id = NEW.school_id AND enrolment.student_id = NEW.student_id
          AND enrolment.programme_id = target_programme
      ) THEN
        RAISE EXCEPTION 'PROGRAMME_ENROLMENT_REQUIRED';
      END IF;
      SELECT count(*) INTO selected_count FROM public.student_programme_subjects selection
      WHERE selection.school_id = NEW.school_id AND selection.student_id = NEW.student_id
        AND selection.programme_id = target_programme;
      IF selected_count <> 4 THEN RAISE EXCEPTION 'STUDENT_SUBJECTS_NOT_SET'; END IF;

      INSERT INTO public.mock_attempt_questions (school_id, attempt_id, mock_version_question_id)
      SELECT NEW.school_id, NEW.id, question.id
      FROM public.mock_version_questions question
      WHERE question.school_id = NEW.school_id AND question.mock_exam_version_id = NEW.mock_exam_version_id
        AND EXISTS (
          SELECT 1 FROM public.student_programme_subjects selection
          WHERE selection.school_id = NEW.school_id AND selection.student_id = NEW.student_id
            AND selection.programme_id = target_programme AND selection.course_id = question.section_course_id
        );
    END IF;
  ELSE
    INSERT INTO public.mock_attempt_questions (school_id, attempt_id, mock_version_question_id)
    SELECT NEW.school_id, NEW.id, question.id
    FROM public.mock_version_questions question
    WHERE question.school_id = NEW.school_id AND question.mock_exam_version_id = NEW.mock_exam_version_id;
  END IF;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 0 THEN RAISE EXCEPTION 'MOCK_HAS_NO_QUESTIONS_FOR_SUBJECTS'; END IF;

  UPDATE public.mock_attempts attempt SET
    total_mcq_questions = (
      SELECT count(*) FROM public.mock_attempt_questions snapshot
      JOIN public.mock_version_questions question ON question.id = snapshot.mock_version_question_id
      JOIN public.bank_question_versions question_version ON question_version.id = question.question_version_id
      JOIN public.bank_questions bank_question ON bank_question.id = question_version.question_id
      WHERE snapshot.attempt_id = NEW.id AND bank_question.question_type = 'mcq'
    ),
    total_marks = (
      SELECT COALESCE(sum(question.marks), 0) FROM public.mock_attempt_questions snapshot
      JOIN public.mock_version_questions question ON question.id = snapshot.mock_version_question_id
      WHERE snapshot.attempt_id = NEW.id
    )
  WHERE attempt.id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_or_resume_mock_offer_attempt_with_subjects(
  p_offer_id UUID,
  p_student_id UUID,
  p_selected_subject_names TEXT[],
  p_now TIMESTAMPTZ
)
RETURNS TABLE(attempt_id UUID, mock_exam_version_id UUID, attempt_number INTEGER, started_at TIMESTAMPTZ, deadline_at TIMESTAMPTZ, resumed BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_offer public.mock_access_offers%ROWTYPE;
  v_entitlement public.mock_entitlements%ROWTYPE;
  v_mock public.mock_exams%ROWTYPE;
  v_attempt public.mock_attempts%ROWTYPE;
  v_deadline TIMESTAMPTZ;
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
      RETURN QUERY SELECT v_attempt.id, v_offer.mock_exam_version_id, v_attempt.attempt_number, v_attempt.started_at, v_attempt.deadline_at, true;
      RETURN;
    END IF;
    RAISE EXCEPTION 'ATTEMPT_EXPIRED';
  END IF;
  IF v_entitlement.attempts_consumed >= v_entitlement.attempts_granted THEN RAISE EXCEPTION 'ATTEMPT_LIMIT_REACHED'; END IF;
  IF v_mock.delivery_mode = 'subject_combination' AND v_mock.audience_scope = 'direct_link' THEN
    IF cardinality(p_selected_subject_names) IS NULL OR cardinality(p_selected_subject_names) = 0 THEN
      RAISE EXCEPTION 'SUBJECT_SELECTION_REQUIRED';
    END IF;
  END IF;
  v_deadline := CASE WHEN COALESCE(v_mock.time_limit_minutes, 0) > 0 THEN p_now + make_interval(mins => v_mock.time_limit_minutes) ELSE NULL END;
  IF v_offer.closes_at IS NOT NULL AND (v_deadline IS NULL OR v_offer.closes_at < v_deadline) THEN v_deadline := v_offer.closes_at; END IF;
  INSERT INTO public.mock_attempts(school_id, mock_exam_id, mock_exam_version_id, student_id, entitlement_id, access_source,
    attempt_number, started_at, deadline_at, last_saved_at, status, total_mcq_questions, total_marks, selected_subject_names)
  VALUES (v_offer.school_id, v_offer.mock_exam_id, v_offer.mock_exam_version_id, p_student_id, v_entitlement.id, 'entitlement',
    v_entitlement.attempts_consumed + 1, p_now, v_deadline, p_now, 'in_progress', 0, 0,
    COALESCE(p_selected_subject_names, '{}'::TEXT[])) RETURNING * INTO v_attempt;
  UPDATE public.mock_entitlements entitlement
    SET attempts_consumed = entitlement.attempts_consumed + 1
    WHERE entitlement.id = v_entitlement.id;
  RETURN QUERY SELECT v_attempt.id, v_offer.mock_exam_version_id, v_attempt.attempt_number, v_attempt.started_at, v_attempt.deadline_at, false;
END;
$$;

REVOKE ALL ON FUNCTION public.start_or_resume_mock_offer_attempt_with_subjects(UUID, UUID, TEXT[], TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_or_resume_mock_offer_attempt_with_subjects(UUID, UUID, TEXT[], TIMESTAMPTZ)
  TO service_role;
