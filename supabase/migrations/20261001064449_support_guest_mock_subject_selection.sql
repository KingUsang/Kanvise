-- Free public subject-combination mocks use the same immutable attempt
-- snapshot as signed-in learners. The choice is made before any questions are
-- written, so a guest cannot alter their paper by changing browser state.
CREATE OR REPLACE FUNCTION public.snapshot_mock_attempt_questions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  delivery TEXT; target_programme UUID; target_audience TEXT;
  selected_count INTEGER; inserted_count INTEGER;
BEGIN
  SELECT mock.delivery_mode, mock.programme_id, mock.audience_scope
    INTO delivery, target_programme, target_audience
  FROM public.mock_exams mock WHERE mock.id = NEW.mock_exam_id AND mock.school_id = NEW.school_id;

  IF delivery = 'subject_combination' THEN
    -- Direct-link offers can be used by an entitled learner or a free guest.
    IF target_audience = 'direct_link' AND NEW.access_source IN ('entitlement', 'guest') THEN
      selected_count := cardinality(NEW.selected_subject_names);
      IF selected_count IS NULL OR selected_count = 0 THEN RAISE EXCEPTION 'SUBJECT_SELECTION_REQUIRED'; END IF;
      IF selected_count <> (SELECT count(DISTINCT item) FROM unnest(NEW.selected_subject_names) AS item) THEN RAISE EXCEPTION 'SUBJECT_SELECTION_DUPLICATE'; END IF;
      IF EXISTS (
        SELECT 1 FROM unnest(NEW.selected_subject_names) AS selection(subject_name)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.mock_version_questions question
          WHERE question.mock_exam_version_id = NEW.mock_exam_version_id
            AND question.school_id = NEW.school_id AND question.section_title = selection.subject_name
        )
      ) THEN RAISE EXCEPTION 'SUBJECT_SELECTION_INVALID'; END IF;

      INSERT INTO public.mock_attempt_questions (school_id, attempt_id, mock_version_question_id)
      SELECT NEW.school_id, NEW.id, question.id FROM public.mock_version_questions question
      WHERE question.school_id = NEW.school_id AND question.mock_exam_version_id = NEW.mock_exam_version_id
        AND question.section_title = ANY(NEW.selected_subject_names);
    ELSE
      -- Programme mocks retain their existing enrollment and four-subject rule.
      IF target_programme IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.enrolments enrolment
        WHERE enrolment.school_id = NEW.school_id AND enrolment.student_id = NEW.student_id
          AND enrolment.programme_id = target_programme
      ) THEN RAISE EXCEPTION 'PROGRAMME_ENROLMENT_REQUIRED'; END IF;
      SELECT count(*) INTO selected_count FROM public.student_programme_subjects selection
      WHERE selection.school_id = NEW.school_id AND selection.student_id = NEW.student_id
        AND selection.programme_id = target_programme;
      IF selected_count <> 4 THEN RAISE EXCEPTION 'STUDENT_SUBJECTS_NOT_SET'; END IF;
      INSERT INTO public.mock_attempt_questions (school_id, attempt_id, mock_version_question_id)
      SELECT NEW.school_id, NEW.id, question.id FROM public.mock_version_questions question
      WHERE question.school_id = NEW.school_id AND question.mock_exam_version_id = NEW.mock_exam_version_id
        AND EXISTS (
          SELECT 1 FROM public.student_programme_subjects selection
          WHERE selection.school_id = NEW.school_id AND selection.student_id = NEW.student_id
            AND selection.programme_id = target_programme AND selection.course_id = question.section_course_id
        );
    END IF;
  ELSE
    INSERT INTO public.mock_attempt_questions (school_id, attempt_id, mock_version_question_id)
    SELECT NEW.school_id, NEW.id, question.id FROM public.mock_version_questions question
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

CREATE OR REPLACE FUNCTION public.start_or_resume_guest_mock_attempt_with_subjects(
  p_guest_id UUID, p_offer_id UUID, p_selected_subject_names TEXT[], p_now TIMESTAMPTZ
) RETURNS TABLE(attempt_id UUID, mock_exam_version_id UUID, started_at TIMESTAMPTZ, deadline_at TIMESTAMPTZ, resumed BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_guest public.guest_mock_learners%ROWTYPE; v_offer public.mock_access_offers%ROWTYPE;
  v_mock public.mock_exams%ROWTYPE; v_attempt public.mock_attempts%ROWTYPE; v_deadline TIMESTAMPTZ;
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
  SELECT * INTO v_mock FROM public.mock_exams WHERE id = v_offer.mock_exam_id AND school_id = v_offer.school_id
    AND delivery_mode IN ('fixed', 'subject_combination');
  IF NOT FOUND THEN RAISE EXCEPTION 'GUEST_MOCK_NOT_AVAILABLE'; END IF;
  SELECT attempt.* INTO v_attempt FROM public.guest_mock_attempts ownership
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
  IF v_mock.delivery_mode = 'subject_combination'
    AND (cardinality(p_selected_subject_names) IS NULL OR cardinality(p_selected_subject_names) = 0)
  THEN RAISE EXCEPTION 'SUBJECT_SELECTION_REQUIRED'; END IF;
  v_deadline := CASE WHEN COALESCE(v_mock.time_limit_minutes, 0) > 0
    THEN p_now + make_interval(mins => v_mock.time_limit_minutes) ELSE NULL END;
  IF v_offer.closes_at IS NOT NULL AND (v_deadline IS NULL OR v_offer.closes_at < v_deadline) THEN v_deadline := v_offer.closes_at; END IF;
  INSERT INTO public.mock_attempts(
    school_id, mock_exam_id, mock_exam_version_id, student_id, entitlement_id, access_source,
    attempt_number, started_at, deadline_at, last_saved_at, status, total_mcq_questions, total_marks, selected_subject_names
  ) VALUES (
    v_offer.school_id, v_offer.mock_exam_id, v_offer.mock_exam_version_id, NULL, NULL, 'guest',
    1, p_now, v_deadline, p_now, 'in_progress', 0, 0, COALESCE(p_selected_subject_names, '{}'::TEXT[])
  ) RETURNING * INTO v_attempt;
  INSERT INTO public.guest_mock_attempts(guest_id, offer_id, attempt_id) VALUES (p_guest_id, p_offer_id, v_attempt.id);
  UPDATE public.guest_mock_learners SET last_seen_at = p_now WHERE id = p_guest_id;
  RETURN QUERY SELECT v_attempt.id, v_attempt.mock_exam_version_id, v_attempt.started_at, v_attempt.deadline_at, false;
END;
$$;

REVOKE ALL ON FUNCTION public.start_or_resume_guest_mock_attempt_with_subjects(UUID, UUID, TEXT[], TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_or_resume_guest_mock_attempt_with_subjects(UUID, UUID, TEXT[], TIMESTAMPTZ)
  TO service_role;
