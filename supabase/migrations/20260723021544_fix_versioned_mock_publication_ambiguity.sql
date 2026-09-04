-- Qualify snapshot columns that collide with RETURNS TABLE output variables.
CREATE OR REPLACE FUNCTION publish_versioned_mock(
    p_school_id UUID, p_mock_exam_id UUID, p_published_by UUID, p_published_at TIMESTAMPTZ
)
RETURNS TABLE(mock_exam_version_id UUID, version_number INTEGER, total_questions INTEGER, total_marks NUMERIC)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
    v_mock mock_exams%ROWTYPE;
    v_version_id UUID;
    v_version_number INTEGER;
    v_section mock_sections%ROWTYPE;
    v_fixed RECORD;
    v_rule mock_question_rules%ROWTYPE;
    v_next_order INTEGER;
    v_inserted INTEGER;
    v_total_questions INTEGER;
    v_total_marks NUMERIC;
BEGIN
    SELECT * INTO v_mock FROM mock_exams
    WHERE id = p_mock_exam_id AND school_id = p_school_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_NOT_FOUND'; END IF;
    IF v_mock.status <> 'draft' THEN RAISE EXCEPTION 'MOCK_NOT_DRAFT'; END IF;
    IF NOT EXISTS (SELECT 1 FROM mock_sections WHERE mock_exam_id = p_mock_exam_id AND school_id = p_school_id)
      THEN RAISE EXCEPTION 'MOCK_HAS_NO_SECTIONS'; END IF;

    SELECT COALESCE(max(mev.version_number), 0) + 1 INTO v_version_number
    FROM mock_exam_versions mev WHERE mev.mock_exam_id = p_mock_exam_id;
    INSERT INTO mock_exam_versions(
        school_id, mock_exam_id, version_number, published_by, published_at, settings
    ) VALUES (
        p_school_id, p_mock_exam_id, v_version_number, p_published_by, COALESCE(p_published_at, now()),
        jsonb_build_object(
            'title', v_mock.title, 'description', v_mock.description, 'course_id', v_mock.course_id,
            'time_limit_minutes', v_mock.time_limit_minutes, 'available_from', v_mock.available_from,
            'closes_at', v_mock.closes_at, 'calculator_mode', v_mock.calculator_mode,
            'shuffle_questions', v_mock.shuffle_questions, 'shuffle_options', v_mock.shuffle_options,
            'result_release_mode', v_mock.result_release_mode, 'pass_mark', v_mock.pass_mark,
            'max_attempts', v_mock.max_attempts
        )
    ) RETURNING id INTO v_version_id;

    FOR v_section IN SELECT * FROM mock_sections
      WHERE mock_exam_id = p_mock_exam_id AND school_id = p_school_id ORDER BY order_index
    LOOP
        v_next_order := 0;
        FOR v_fixed IN
            SELECT msq.question_version_id, COALESCE(msq.marks_override, bqv.marks) AS marks
            FROM mock_section_questions msq
            JOIN bank_question_versions bqv ON bqv.id = msq.question_version_id
            WHERE msq.section_id = v_section.id AND msq.school_id = p_school_id
            ORDER BY msq.order_index
        LOOP
            INSERT INTO mock_version_questions(
                school_id, mock_exam_version_id, question_version_id,
                section_title, section_order_index, order_index, marks
            ) VALUES (
                p_school_id, v_version_id, v_fixed.question_version_id,
                v_section.title, v_section.order_index, v_next_order, v_fixed.marks
            );
            v_next_order := v_next_order + 1;
        END LOOP;

        FOR v_rule IN SELECT * FROM mock_question_rules
          WHERE section_id = v_section.id ORDER BY created_at, id
        LOOP
            INSERT INTO mock_version_questions(
                school_id, mock_exam_version_id, question_version_id,
                section_title, section_order_index, order_index, marks
            )
            SELECT p_school_id, v_version_id, bq.current_version_id,
                v_section.title, v_section.order_index,
                (v_next_order + row_number() OVER (
                    ORDER BY md5(bq.id::TEXT || ':' || v_version_number::TEXT || ':' || v_rule.id::TEXT)
                ) - 1)::INTEGER, bqv.marks
            FROM bank_questions bq
            JOIN bank_question_versions bqv ON bqv.id = bq.current_version_id
            WHERE bq.school_id = p_school_id AND bq.bank_id = v_rule.bank_id
              AND bq.status = 'active' AND bq.archived_at IS NULL
              AND (v_rule.subject_name IS NULL OR bq.subject_name = v_rule.subject_name)
              AND (v_rule.topic IS NULL OR bq.topic = v_rule.topic)
              AND (v_rule.subtopic IS NULL OR bq.subtopic = v_rule.subtopic)
              AND (v_rule.question_type IS NULL OR bq.question_type = v_rule.question_type)
              AND NOT EXISTS (
                  SELECT 1 FROM mock_version_questions mvq
                  WHERE mvq.mock_exam_version_id = v_version_id
                    AND mvq.question_version_id = bq.current_version_id
              )
            ORDER BY md5(bq.id::TEXT || ':' || v_version_number::TEXT || ':' || v_rule.id::TEXT)
            LIMIT v_rule.question_count;
            GET DIAGNOSTICS v_inserted = ROW_COUNT;
            IF v_inserted <> v_rule.question_count THEN RAISE EXCEPTION 'RANDOM_POOL_TOO_SMALL'; END IF;
            v_next_order := v_next_order + v_inserted;
        END LOOP;
    END LOOP;

    SELECT count(*), COALESCE(sum(mvq.marks), 0)
    INTO v_total_questions, v_total_marks
    FROM mock_version_questions mvq WHERE mvq.mock_exam_version_id = v_version_id;
    IF v_total_questions = 0 THEN RAISE EXCEPTION 'MOCK_HAS_NO_QUESTIONS'; END IF;
    UPDATE mock_exam_versions SET total_questions = v_total_questions, total_marks = v_total_marks
    WHERE id = v_version_id;
    UPDATE mock_exams SET status = 'published', publish_at = COALESCE(p_published_at, now()), updated_at = now()
    WHERE id = p_mock_exam_id AND school_id = p_school_id;
    RETURN QUERY SELECT v_version_id, v_version_number, v_total_questions, v_total_marks;
END;
$$;

REVOKE ALL ON FUNCTION publish_versioned_mock(UUID, UUID, UUID, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION publish_versioned_mock(UUID, UUID, UUID, TIMESTAMPTZ) TO service_role;
