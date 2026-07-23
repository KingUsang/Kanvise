-- Transactional draft assembly and immutable mock publication.

ALTER TABLE mock_version_questions
    ADD CONSTRAINT mock_version_questions_unique_question
    UNIQUE (mock_exam_version_id, question_version_id);

CREATE OR REPLACE FUNCTION replace_versioned_mock_assembly(
    p_school_id UUID,
    p_mock_exam_id UUID,
    p_sections JSONB
)
RETURNS TABLE(section_count INTEGER, fixed_question_count INTEGER, rule_count INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_mock mock_exams%ROWTYPE;
    v_section_json JSONB;
    v_question_json JSONB;
    v_rule_json JSONB;
    v_section_id UUID;
    v_question_id UUID;
    v_question_version_id UUID;
    v_section_order INTEGER := 0;
    v_question_order INTEGER;
    v_sections INTEGER := 0;
    v_questions INTEGER := 0;
    v_rules INTEGER := 0;
BEGIN
    IF jsonb_typeof(COALESCE(p_sections, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'SECTIONS_MUST_BE_ARRAY';
    END IF;
    SELECT * INTO v_mock FROM mock_exams
    WHERE id = p_mock_exam_id AND school_id = p_school_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_NOT_FOUND'; END IF;
    IF v_mock.status <> 'draft' THEN RAISE EXCEPTION 'MOCK_NOT_DRAFT'; END IF;

    DELETE FROM mock_sections WHERE mock_exam_id = p_mock_exam_id AND school_id = p_school_id;

    FOR v_section_json IN SELECT value FROM jsonb_array_elements(COALESCE(p_sections, '[]'::jsonb))
    LOOP
        IF btrim(COALESCE(v_section_json ->> 'title', '')) = '' THEN
            RAISE EXCEPTION 'SECTION_TITLE_REQUIRED';
        END IF;
        IF NULLIF(v_section_json ->> 'course_id', '') IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM courses
            WHERE id = (v_section_json ->> 'course_id')::UUID AND school_id = p_school_id
        ) THEN RAISE EXCEPTION 'SECTION_COURSE_NOT_FOUND'; END IF;

        INSERT INTO mock_sections (
            school_id, mock_exam_id, course_id, title, subject_name, instructions, order_index
        ) VALUES (
            p_school_id, p_mock_exam_id, NULLIF(v_section_json ->> 'course_id', '')::UUID,
            btrim(v_section_json ->> 'title'), NULLIF(btrim(v_section_json ->> 'subject_name'), ''),
            NULLIF(btrim(v_section_json ->> 'instructions'), ''), v_section_order
        ) RETURNING id INTO v_section_id;
        v_sections := v_sections + 1;
        v_question_order := 0;

        IF jsonb_typeof(COALESCE(v_section_json -> 'questions', '[]'::jsonb)) <> 'array' THEN
            RAISE EXCEPTION 'SECTION_QUESTIONS_MUST_BE_ARRAY';
        END IF;
        FOR v_question_json IN
            SELECT value FROM jsonb_array_elements(COALESCE(v_section_json -> 'questions', '[]'::jsonb))
        LOOP
            BEGIN
                v_question_id := (v_question_json ->> 'question_id')::UUID;
            EXCEPTION WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'INVALID_QUESTION_ID';
            END;
            IF NULLIF(v_question_json ->> 'question_version_id', '') IS NULL THEN
                SELECT current_version_id INTO v_question_version_id FROM bank_questions
                WHERE id = v_question_id AND school_id = p_school_id
                  AND status = 'active' AND archived_at IS NULL;
            ELSE
                v_question_version_id := (v_question_json ->> 'question_version_id')::UUID;
            END IF;
            IF v_question_version_id IS NULL OR NOT EXISTS (
                SELECT 1 FROM bank_question_versions
                WHERE id = v_question_version_id AND question_id = v_question_id
                  AND school_id = p_school_id
            ) THEN RAISE EXCEPTION 'QUESTION_VERSION_NOT_FOUND'; END IF;

            INSERT INTO mock_section_questions (
                school_id, section_id, question_id, question_version_id, order_index, marks_override
            ) VALUES (
                p_school_id, v_section_id, v_question_id, v_question_version_id, v_question_order,
                NULLIF(v_question_json ->> 'marks_override', '')::NUMERIC
            );
            v_question_order := v_question_order + 1;
            v_questions := v_questions + 1;
        END LOOP;

        IF jsonb_typeof(COALESCE(v_section_json -> 'rules', '[]'::jsonb)) <> 'array' THEN
            RAISE EXCEPTION 'SECTION_RULES_MUST_BE_ARRAY';
        END IF;
        FOR v_rule_json IN
            SELECT value FROM jsonb_array_elements(COALESCE(v_section_json -> 'rules', '[]'::jsonb))
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM question_banks
                WHERE id = (v_rule_json ->> 'bank_id')::UUID
                  AND school_id = p_school_id AND archived_at IS NULL
            ) THEN RAISE EXCEPTION 'RULE_BANK_NOT_FOUND'; END IF;
            IF COALESCE((v_rule_json ->> 'question_count')::INTEGER, 0) <= 0 THEN
                RAISE EXCEPTION 'RULE_QUESTION_COUNT_INVALID';
            END IF;
            INSERT INTO mock_question_rules (
                school_id, section_id, bank_id, subject_name, topic, subtopic,
                question_type, question_count
            ) VALUES (
                p_school_id, v_section_id, (v_rule_json ->> 'bank_id')::UUID,
                NULLIF(btrim(v_rule_json ->> 'subject_name'), ''),
                NULLIF(btrim(v_rule_json ->> 'topic'), ''),
                NULLIF(btrim(v_rule_json ->> 'subtopic'), ''),
                NULLIF(v_rule_json ->> 'question_type', ''),
                (v_rule_json ->> 'question_count')::INTEGER
            );
            v_rules := v_rules + 1;
        END LOOP;
        v_section_order := v_section_order + 1;
    END LOOP;

    UPDATE mock_exams SET
        total_mcq_questions = (
            SELECT count(*) FROM mock_section_questions msq
            JOIN mock_sections ms ON ms.id = msq.section_id
            JOIN bank_questions bq ON bq.id = msq.question_id
            WHERE ms.mock_exam_id = p_mock_exam_id AND bq.question_type = 'mcq'
        ),
        total_theory_questions = (
            SELECT count(*) FROM mock_section_questions msq
            JOIN mock_sections ms ON ms.id = msq.section_id
            JOIN bank_questions bq ON bq.id = msq.question_id
            WHERE ms.mock_exam_id = p_mock_exam_id AND bq.question_type = 'theory'
        ),
        updated_at = now()
    WHERE id = p_mock_exam_id AND school_id = p_school_id;

    RETURN QUERY SELECT v_sections, v_questions, v_rules;
END;
$$;

CREATE OR REPLACE FUNCTION publish_versioned_mock(
    p_school_id UUID,
    p_mock_exam_id UUID,
    p_published_by UUID,
    p_published_at TIMESTAMPTZ
)
RETURNS TABLE(
    mock_exam_version_id UUID,
    version_number INTEGER,
    total_questions INTEGER,
    total_marks NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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
    WHERE id = p_mock_exam_id AND school_id = p_school_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_NOT_FOUND'; END IF;
    IF v_mock.status <> 'draft' THEN RAISE EXCEPTION 'MOCK_NOT_DRAFT'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM mock_sections WHERE mock_exam_id = p_mock_exam_id AND school_id = p_school_id
    ) THEN RAISE EXCEPTION 'MOCK_HAS_NO_SECTIONS'; END IF;

    SELECT COALESCE(max(mev.version_number), 0) + 1 INTO v_version_number
    FROM mock_exam_versions mev WHERE mev.mock_exam_id = p_mock_exam_id;

    INSERT INTO mock_exam_versions (
        school_id, mock_exam_id, version_number, published_by, published_at, settings
    ) VALUES (
        p_school_id, p_mock_exam_id, v_version_number, p_published_by,
        COALESCE(p_published_at, now()),
        jsonb_build_object(
            'title', v_mock.title,
            'description', v_mock.description,
            'course_id', v_mock.course_id,
            'time_limit_minutes', v_mock.time_limit_minutes,
            'available_from', v_mock.available_from,
            'closes_at', v_mock.closes_at,
            'calculator_mode', v_mock.calculator_mode,
            'shuffle_questions', v_mock.shuffle_questions,
            'shuffle_options', v_mock.shuffle_options,
            'result_release_mode', v_mock.result_release_mode,
            'pass_mark', v_mock.pass_mark,
            'max_attempts', v_mock.max_attempts
        )
    ) RETURNING id INTO v_version_id;

    FOR v_section IN
        SELECT * FROM mock_sections
        WHERE mock_exam_id = p_mock_exam_id AND school_id = p_school_id
        ORDER BY order_index
    LOOP
        v_next_order := 0;
        FOR v_fixed IN
            SELECT msq.question_version_id, COALESCE(msq.marks_override, bqv.marks) AS marks
            FROM mock_section_questions msq
            JOIN bank_question_versions bqv ON bqv.id = msq.question_version_id
            WHERE msq.section_id = v_section.id AND msq.school_id = p_school_id
            ORDER BY msq.order_index
        LOOP
            INSERT INTO mock_version_questions (
                school_id, mock_exam_version_id, question_version_id,
                section_title, section_order_index, order_index, marks
            ) VALUES (
                p_school_id, v_version_id, v_fixed.question_version_id,
                v_section.title, v_section.order_index, v_next_order, v_fixed.marks
            );
            v_next_order := v_next_order + 1;
        END LOOP;

        FOR v_rule IN
            SELECT * FROM mock_question_rules WHERE section_id = v_section.id
            ORDER BY created_at, id
        LOOP
            INSERT INTO mock_version_questions (
                school_id, mock_exam_version_id, question_version_id,
                section_title, section_order_index, order_index, marks
            )
            SELECT
                p_school_id, v_version_id, bq.current_version_id,
                v_section.title, v_section.order_index,
                (v_next_order + row_number() OVER (
                    ORDER BY md5(bq.id::TEXT || ':' || v_version_number::TEXT || ':' || v_rule.id::TEXT)
                ) - 1)::INTEGER,
                bqv.marks
            FROM bank_questions bq
            JOIN bank_question_versions bqv ON bqv.id = bq.current_version_id
            WHERE bq.school_id = p_school_id
              AND bq.bank_id = v_rule.bank_id
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
            IF v_inserted <> v_rule.question_count THEN
                RAISE EXCEPTION 'RANDOM_POOL_TOO_SMALL';
            END IF;
            v_next_order := v_next_order + v_inserted;
        END LOOP;
    END LOOP;

    SELECT count(*), COALESCE(sum(mvq.marks), 0)
    INTO v_total_questions, v_total_marks
    FROM mock_version_questions mvq WHERE mvq.mock_exam_version_id = v_version_id;
    IF v_total_questions = 0 THEN RAISE EXCEPTION 'MOCK_HAS_NO_QUESTIONS'; END IF;

    UPDATE mock_exam_versions SET
        total_questions = v_total_questions,
        total_marks = v_total_marks
    WHERE id = v_version_id;

    UPDATE mock_exams SET
        status = 'published',
        publish_at = COALESCE(p_published_at, now()),
        updated_at = now()
    WHERE id = p_mock_exam_id AND school_id = p_school_id;

    RETURN QUERY SELECT v_version_id, v_version_number, v_total_questions, v_total_marks;
END;
$$;

REVOKE ALL ON FUNCTION replace_versioned_mock_assembly(UUID, UUID, JSONB)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION publish_versioned_mock(UUID, UUID, UUID, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_versioned_mock_assembly(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION publish_versioned_mock(UUID, UUID, UUID, TIMESTAMPTZ) TO service_role;
