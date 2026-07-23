-- Race-safe student attempt lifecycle for immutable mock versions.

ALTER TABLE mock_answers
    ALTER COLUMN question_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;

ALTER TABLE mock_attempts
    ADD COLUMN IF NOT EXISTS theory_score NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS total_score NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS total_marks NUMERIC(10,2);

CREATE OR REPLACE FUNCTION start_or_resume_versioned_mock_attempt(
    p_school_id UUID,
    p_mock_exam_id UUID,
    p_student_id UUID,
    p_now TIMESTAMPTZ
)
RETURNS TABLE(
    attempt_id UUID,
    mock_exam_version_id UUID,
    attempt_number INTEGER,
    started_at TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ,
    resumed BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_mock mock_exams%ROWTYPE;
    v_version mock_exam_versions%ROWTYPE;
    v_attempt mock_attempts%ROWTYPE;
    v_attempts_used INTEGER;
    v_extra_attempts INTEGER;
    v_deadline TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_mock FROM mock_exams mx
    WHERE mx.id = p_mock_exam_id AND mx.school_id = p_school_id
    FOR SHARE;
    IF NOT FOUND OR v_mock.status <> 'published' THEN RAISE EXCEPTION 'MOCK_NOT_AVAILABLE'; END IF;
    IF v_mock.available_from IS NOT NULL AND p_now < v_mock.available_from THEN RAISE EXCEPTION 'MOCK_NOT_OPEN'; END IF;
    IF v_mock.closes_at IS NOT NULL AND p_now >= v_mock.closes_at THEN RAISE EXCEPTION 'MOCK_CLOSED'; END IF;

    SELECT * INTO v_version FROM mock_exam_versions mev
    WHERE mev.mock_exam_id = p_mock_exam_id AND mev.school_id = p_school_id
    ORDER BY mev.version_number DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_VERSION_NOT_FOUND'; END IF;

    SELECT * INTO v_attempt FROM mock_attempts ma
    WHERE ma.mock_exam_version_id = v_version.id AND ma.student_id = p_student_id
      AND ma.school_id = p_school_id AND ma.status = 'in_progress'
    ORDER BY ma.attempt_number DESC LIMIT 1 FOR UPDATE;
    IF FOUND THEN
        IF v_attempt.deadline_at IS NULL OR p_now < v_attempt.deadline_at THEN
            RETURN QUERY SELECT v_attempt.id, v_version.id, v_attempt.attempt_number,
                v_attempt.started_at, v_attempt.deadline_at, true;
            RETURN;
        END IF;
        RAISE EXCEPTION 'ATTEMPT_EXPIRED';
    END IF;

    SELECT count(*)::INTEGER INTO v_attempts_used FROM mock_attempts ma
    WHERE ma.mock_exam_version_id = v_version.id AND ma.student_id = p_student_id
      AND ma.school_id = p_school_id;
    SELECT COALESCE(sum(additional_attempts), 0)::INTEGER INTO v_extra_attempts
    FROM mock_attempt_grants mag WHERE mag.mock_exam_version_id = v_version.id
      AND mag.student_id = p_student_id AND mag.school_id = p_school_id AND mag.revoked_at IS NULL;
    IF v_attempts_used >= v_mock.max_attempts + v_extra_attempts THEN
        RAISE EXCEPTION 'ATTEMPT_LIMIT_REACHED';
    END IF;

    v_deadline := CASE WHEN COALESCE(v_mock.time_limit_minutes, 0) > 0
        THEN p_now + make_interval(mins => v_mock.time_limit_minutes) ELSE NULL END;
    IF v_mock.closes_at IS NOT NULL AND (v_deadline IS NULL OR v_mock.closes_at < v_deadline) THEN
        v_deadline := v_mock.closes_at;
    END IF;

    INSERT INTO mock_attempts (
        school_id, mock_exam_id, mock_exam_version_id, student_id, attempt_number,
        started_at, deadline_at, last_saved_at, status, total_mcq_questions, total_marks
    ) VALUES (
        p_school_id, p_mock_exam_id, v_version.id, p_student_id, v_attempts_used + 1,
        p_now, v_deadline, p_now, 'in_progress',
        (SELECT count(*) FROM mock_version_questions mvq
          JOIN bank_question_versions bqv ON bqv.id = mvq.question_version_id
          JOIN bank_questions bq ON bq.id = bqv.question_id
          WHERE mvq.mock_exam_version_id = v_version.id AND bq.question_type = 'mcq'),
        v_version.total_marks
    ) RETURNING * INTO v_attempt;

    RETURN QUERY SELECT v_attempt.id, v_version.id, v_attempt.attempt_number,
        v_attempt.started_at, v_attempt.deadline_at, false;
END;
$$;

CREATE OR REPLACE FUNCTION save_versioned_mock_answer(
    p_school_id UUID,
    p_attempt_id UUID,
    p_student_id UUID,
    p_mock_version_question_id UUID,
    p_selected_option_version_id UUID,
    p_theory_answer_text TEXT,
    p_is_flagged BOOLEAN,
    p_now TIMESTAMPTZ
)
RETURNS TABLE(answer_id UUID, saved_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_attempt mock_attempts%ROWTYPE;
    v_question RECORD;
    v_answer mock_answers%ROWTYPE;
BEGIN
    SELECT * INTO v_attempt FROM mock_attempts ma
    WHERE ma.id = p_attempt_id AND ma.school_id = p_school_id AND ma.student_id = p_student_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ATTEMPT_NOT_FOUND'; END IF;
    IF v_attempt.status <> 'in_progress' THEN RAISE EXCEPTION 'ATTEMPT_FINALIZED'; END IF;
    IF v_attempt.deadline_at IS NOT NULL AND p_now >= v_attempt.deadline_at THEN
        RAISE EXCEPTION 'ATTEMPT_EXPIRED';
    END IF;

    SELECT mvq.id, bq.question_type, bqv.id AS question_version_id
    INTO v_question
    FROM mock_version_questions mvq
    JOIN bank_question_versions bqv ON bqv.id = mvq.question_version_id
    JOIN bank_questions bq ON bq.id = bqv.question_id
    WHERE mvq.id = p_mock_version_question_id
      AND mvq.mock_exam_version_id = v_attempt.mock_exam_version_id
      AND mvq.school_id = p_school_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'ATTEMPT_QUESTION_NOT_FOUND'; END IF;

    IF v_question.question_type = 'mcq' THEN
        IF p_theory_answer_text IS NOT NULL THEN RAISE EXCEPTION 'MCQ_THEORY_ANSWER_INVALID'; END IF;
        IF p_selected_option_version_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM bank_question_option_versions
            WHERE bank_question_option_versions.id = p_selected_option_version_id
              AND bank_question_option_versions.question_version_id = v_question.question_version_id
              AND bank_question_option_versions.school_id = p_school_id
        ) THEN RAISE EXCEPTION 'OPTION_NOT_FOUND'; END IF;
    ELSE
        IF p_selected_option_version_id IS NOT NULL THEN RAISE EXCEPTION 'THEORY_OPTION_INVALID'; END IF;
    END IF;

    INSERT INTO mock_answers (
        school_id, attempt_id, mock_version_question_id, selected_option_version_id,
        theory_answer_text, is_flagged, saved_at
    ) VALUES (
        p_school_id, p_attempt_id, p_mock_version_question_id, p_selected_option_version_id,
        NULLIF(p_theory_answer_text, ''), COALESCE(p_is_flagged, false), p_now
    )
    ON CONFLICT (attempt_id, mock_version_question_id)
      WHERE mock_version_question_id IS NOT NULL
    DO UPDATE SET
        selected_option_version_id = EXCLUDED.selected_option_version_id,
        theory_answer_text = EXCLUDED.theory_answer_text,
        is_flagged = EXCLUDED.is_flagged,
        saved_at = EXCLUDED.saved_at
    RETURNING * INTO v_answer;

    UPDATE mock_attempts ma SET last_saved_at = p_now WHERE ma.id = p_attempt_id;
    RETURN QUERY SELECT v_answer.id, v_answer.saved_at;
END;
$$;

CREATE OR REPLACE FUNCTION submit_versioned_mock_attempt(
    p_school_id UUID,
    p_attempt_id UUID,
    p_student_id UUID,
    p_now TIMESTAMPTZ,
    p_reason TEXT
)
RETURNS TABLE(
    status TEXT,
    mcq_score NUMERIC,
    total_score NUMERIC,
    total_marks NUMERIC,
    submitted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_attempt mock_attempts%ROWTYPE;
    v_mcq_score NUMERIC;
    v_total_score NUMERIC;
    v_total_marks NUMERIC;
    v_correct INTEGER;
    v_status TEXT;
    v_reason TEXT;
BEGIN
    SELECT * INTO v_attempt FROM mock_attempts ma
    WHERE ma.id = p_attempt_id AND ma.school_id = p_school_id AND ma.student_id = p_student_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ATTEMPT_NOT_FOUND'; END IF;
    IF v_attempt.status <> 'in_progress' THEN
        RETURN QUERY SELECT v_attempt.status, v_attempt.mcq_score, v_attempt.total_score,
            v_attempt.total_marks, v_attempt.submitted_at;
        RETURN;
    END IF;

    v_reason := CASE WHEN v_attempt.deadline_at IS NOT NULL AND p_now >= v_attempt.deadline_at
        THEN 'timeout' ELSE COALESCE(p_reason, 'student') END;
    IF v_reason NOT IN ('student', 'timeout', 'admin') THEN RAISE EXCEPTION 'INVALID_SUBMISSION_REASON'; END IF;
    v_status := CASE WHEN v_reason = 'timeout' THEN 'timed_out' ELSE 'submitted' END;

    UPDATE mock_answers ma SET is_correct = (
        SELECT bov.is_correct
        FROM mock_version_questions mvq
        JOIN bank_question_versions bqv ON bqv.id = mvq.question_version_id
        JOIN bank_questions bq ON bq.id = bqv.question_id AND bq.question_type = 'mcq'
        LEFT JOIN bank_question_option_versions bov
          ON bov.id = ma.selected_option_version_id AND bov.question_version_id = bqv.id
        WHERE mvq.id = ma.mock_version_question_id
    )
    WHERE ma.attempt_id = p_attempt_id AND EXISTS (
        SELECT 1 FROM mock_version_questions mvq
        JOIN bank_question_versions bqv ON bqv.id = mvq.question_version_id
        JOIN bank_questions bq ON bq.id = bqv.question_id AND bq.question_type = 'mcq'
        WHERE mvq.id = ma.mock_version_question_id
    );

    SELECT COALESCE(sum(CASE WHEN ma.is_correct THEN mvq.marks ELSE 0 END), 0),
           (count(*) FILTER (WHERE ma.is_correct))::INTEGER
    INTO v_mcq_score, v_correct
    FROM mock_version_questions mvq
    JOIN bank_question_versions bqv ON bqv.id = mvq.question_version_id
    JOIN bank_questions bq ON bq.id = bqv.question_id AND bq.question_type = 'mcq'
    LEFT JOIN mock_answers ma ON ma.attempt_id = p_attempt_id AND ma.mock_version_question_id = mvq.id
    WHERE mvq.mock_exam_version_id = v_attempt.mock_exam_version_id;
    SELECT mev.total_marks INTO v_total_marks FROM mock_exam_versions mev WHERE mev.id = v_attempt.mock_exam_version_id;
    v_total_score := v_mcq_score + COALESCE(v_attempt.theory_score, 0);

    UPDATE mock_attempts ma SET
        status = v_status, submitted_at = p_now, finalized_at = p_now,
        submission_reason = v_reason, mcq_score = v_mcq_score,
        correct_mcq_answers = v_correct, total_score = v_total_score,
        total_marks = v_total_marks, last_saved_at = p_now
    WHERE ma.id = p_attempt_id
    RETURNING ma.* INTO v_attempt;

    RETURN QUERY SELECT v_attempt.status, v_attempt.mcq_score, v_attempt.total_score,
        v_attempt.total_marks, v_attempt.submitted_at;
END;
$$;

REVOKE ALL ON FUNCTION start_or_resume_versioned_mock_attempt(UUID, UUID, UUID, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION save_versioned_mock_answer(UUID, UUID, UUID, UUID, UUID, TEXT, BOOLEAN, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION submit_versioned_mock_attempt(UUID, UUID, UUID, TIMESTAMPTZ, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION start_or_resume_versioned_mock_attempt(UUID, UUID, UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION save_versioned_mock_answer(UUID, UUID, UUID, UUID, UUID, TEXT, BOOLEAN, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION submit_versioned_mock_attempt(UUID, UUID, UUID, TIMESTAMPTZ, TEXT) TO service_role;
