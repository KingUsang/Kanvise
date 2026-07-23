-- Make the visual mock builder write to the same immutable, versioned engine
-- used by student CBT attempts.

ALTER TABLE question_banks
    ADD COLUMN source_mock_exam_id UUID UNIQUE
    REFERENCES mock_exams(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION replace_authored_mock_questions(
    p_school_id UUID,
    p_mock_exam_id UUID,
    p_author_id UUID,
    p_questions JSONB
)
RETURNS TABLE(bank_id UUID, section_id UUID, question_count INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_mock mock_exams%ROWTYPE;
    v_bank_id UUID;
    v_section_id UUID;
    v_question JSONB;
    v_option JSONB;
    v_question_id UUID;
    v_version_id UUID;
    v_question_type TEXT;
    v_plain_text TEXT;
    v_marks NUMERIC;
    v_question_index INTEGER := 0;
    v_option_index INTEGER;
    v_correct_options INTEGER;
BEGIN
    IF jsonb_typeof(COALESCE(p_questions, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'QUESTIONS_MUST_BE_ARRAY';
    END IF;

    SELECT * INTO v_mock
    FROM mock_exams
    WHERE id = p_mock_exam_id AND school_id = p_school_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_NOT_FOUND'; END IF;
    IF v_mock.status <> 'draft' THEN RAISE EXCEPTION 'MOCK_NOT_DRAFT'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = p_author_id AND school_id = p_school_id
          AND role IN ('admin', 'tutor') AND is_active = true
    ) THEN RAISE EXCEPTION 'AUTHOR_NOT_FOUND'; END IF;

    SELECT qb.id INTO v_bank_id
    FROM question_banks qb
    WHERE qb.source_mock_exam_id = p_mock_exam_id
      AND qb.school_id = p_school_id
    FOR UPDATE;

    IF v_bank_id IS NULL THEN
        INSERT INTO question_banks (
            school_id, owner_id, name, description, visibility, source_mock_exam_id
        ) VALUES (
            p_school_id,
            p_author_id,
            left(v_mock.title || ' questions', 160),
            'Questions written while building this mock.',
            'private',
            p_mock_exam_id
        )
        RETURNING id INTO v_bank_id;
    ELSE
        UPDATE question_banks
        SET name = left(v_mock.title || ' questions', 160),
            updated_at = now(),
            archived_at = NULL
        WHERE id = v_bank_id;
    END IF;

    -- Draft-only replacement is safe: immutable published snapshots prevent
    -- deletion once any version references these question versions.
    DELETE FROM mock_sections
    WHERE mock_exam_id = p_mock_exam_id AND school_id = p_school_id;
    DELETE FROM bank_questions bq
    WHERE bq.bank_id = v_bank_id AND bq.school_id = p_school_id;

    INSERT INTO mock_sections (
        school_id, mock_exam_id, course_id, title, instructions, order_index
    ) VALUES (
        p_school_id, p_mock_exam_id, v_mock.course_id, 'Questions', NULL, 0
    )
    RETURNING id INTO v_section_id;

    FOR v_question IN
        SELECT value FROM jsonb_array_elements(COALESCE(p_questions, '[]'::jsonb))
    LOOP
        v_question_type := lower(COALESCE(v_question ->> 'question_type', ''));
        v_plain_text := btrim(COALESCE(
            v_question ->> 'plain_text',
            v_question ->> 'question_text',
            ''
        ));
        v_marks := COALESCE((v_question ->> 'marks')::NUMERIC, 0);

        IF v_question_type NOT IN ('mcq', 'theory') THEN
            RAISE EXCEPTION 'QUESTION_TYPE_INVALID';
        END IF;
        IF v_plain_text = '' AND jsonb_array_length(COALESCE(v_question -> 'content_blocks', '[]'::jsonb)) = 0 THEN
            RAISE EXCEPTION 'QUESTION_TEXT_REQUIRED';
        END IF;
        IF v_marks <= 0 THEN RAISE EXCEPTION 'QUESTION_MARKS_INVALID'; END IF;

        IF v_question_type = 'mcq' THEN
            IF jsonb_typeof(COALESCE(v_question -> 'options', '[]'::jsonb)) <> 'array'
                OR jsonb_array_length(COALESCE(v_question -> 'options', '[]'::jsonb)) < 2 THEN
                RAISE EXCEPTION 'MCQ_OPTIONS_REQUIRED';
            END IF;
            SELECT count(*) INTO v_correct_options
            FROM jsonb_array_elements(v_question -> 'options') item
            WHERE COALESCE((item.value ->> 'is_correct')::BOOLEAN, false);
            IF v_correct_options <> 1 THEN
                RAISE EXCEPTION 'MCQ_ONE_CORRECT_OPTION_REQUIRED';
            END IF;
        END IF;

        INSERT INTO bank_questions (
            school_id, bank_id, author_id, course_id, subject_name, topic,
            subtopic, question_type, status
        ) VALUES (
            p_school_id, v_bank_id, p_author_id, v_mock.course_id,
            NULLIF(btrim(v_question ->> 'subject_name'), ''),
            NULLIF(btrim(v_question ->> 'topic'), ''),
            NULLIF(btrim(v_question ->> 'subtopic'), ''),
            v_question_type, 'active'
        )
        RETURNING id INTO v_question_id;

        INSERT INTO bank_question_versions (
            school_id, question_id, version_number, created_by, plain_text,
            content_blocks, explanation_blocks, grading_rubric_blocks, marks
        ) VALUES (
            p_school_id,
            v_question_id,
            1,
            p_author_id,
            v_plain_text,
            COALESCE(v_question -> 'content_blocks',
                CASE WHEN v_plain_text = '' THEN '[]'::jsonb
                     ELSE jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_plain_text))
                END),
            COALESCE(v_question -> 'explanation_blocks', '[]'::jsonb),
            COALESCE(
                v_question -> 'grading_rubric_blocks',
                CASE WHEN btrim(COALESCE(v_question ->> 'grading_rubric', '')) = '' THEN '[]'::jsonb
                     ELSE jsonb_build_array(jsonb_build_object(
                         'type', 'text', 'text', btrim(v_question ->> 'grading_rubric')
                     ))
                END
            ),
            v_marks
        )
        RETURNING id INTO v_version_id;

        UPDATE bank_questions
        SET current_version_id = v_version_id
        WHERE id = v_question_id;

        v_option_index := 0;
        FOR v_option IN
            SELECT value FROM jsonb_array_elements(COALESCE(v_question -> 'options', '[]'::jsonb))
        LOOP
            IF btrim(COALESCE(v_option ->> 'plain_text', v_option ->> 'option_text', '')) = '' THEN
                RAISE EXCEPTION 'OPTION_TEXT_REQUIRED';
            END IF;
            INSERT INTO bank_question_option_versions (
                school_id, question_version_id, plain_text, content_blocks,
                is_correct, order_index
            ) VALUES (
                p_school_id,
                v_version_id,
                btrim(COALESCE(v_option ->> 'plain_text', v_option ->> 'option_text', '')),
                COALESCE(v_option -> 'content_blocks', jsonb_build_array(jsonb_build_object(
                    'type', 'text',
                    'text', btrim(COALESCE(v_option ->> 'plain_text', v_option ->> 'option_text', ''))
                ))),
                COALESCE((v_option ->> 'is_correct')::BOOLEAN, false),
                v_option_index
            );
            v_option_index := v_option_index + 1;
        END LOOP;

        INSERT INTO mock_section_questions (
            school_id, section_id, question_id, question_version_id,
            order_index, marks_override
        ) VALUES (
            p_school_id, v_section_id, v_question_id, v_version_id,
            v_question_index, NULL
        );
        v_question_index := v_question_index + 1;
    END LOOP;

    UPDATE mock_exams
    SET total_mcq_questions = (
            SELECT count(*) FROM bank_questions bq
            WHERE bq.bank_id = v_bank_id AND bq.question_type = 'mcq'
        ),
        total_theory_questions = (
            SELECT count(*) FROM bank_questions bq
            WHERE bq.bank_id = v_bank_id AND bq.question_type = 'theory'
        ),
        updated_at = now()
    WHERE id = p_mock_exam_id;

    RETURN QUERY SELECT v_bank_id, v_section_id, v_question_index;
END;
$$;

REVOKE ALL ON FUNCTION replace_authored_mock_questions(UUID, UUID, UUID, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_authored_mock_questions(UUID, UUID, UUID, JSONB)
    TO service_role;
