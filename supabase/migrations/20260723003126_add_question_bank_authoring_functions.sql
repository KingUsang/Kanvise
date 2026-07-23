-- Atomic authoring functions used only by the Hono service-role client.

ALTER TABLE bank_questions
    ADD COLUMN search_text TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_bank_questions_search_text
    ON bank_questions USING gin (to_tsvector('simple', search_text));

CREATE OR REPLACE FUNCTION create_bank_question_versioned(
    p_school_id UUID,
    p_bank_id UUID,
    p_author_id UUID,
    p_course_id UUID,
    p_subject_name TEXT,
    p_topic TEXT,
    p_subtopic TEXT,
    p_question_type TEXT,
    p_plain_text TEXT,
    p_content_blocks JSONB,
    p_explanation_blocks JSONB,
    p_grading_rubric_blocks JSONB,
    p_marks NUMERIC,
    p_stimulus_id UUID,
    p_options JSONB
)
RETURNS TABLE(question_id UUID, version_id UUID)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_question_id UUID;
    v_version_id UUID;
    v_option JSONB;
    v_order INTEGER := 0;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM question_banks
        WHERE id = p_bank_id AND school_id = p_school_id AND archived_at IS NULL
    ) THEN
        RAISE EXCEPTION 'QUESTION_BANK_NOT_FOUND';
    END IF;

    IF p_course_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM courses WHERE id = p_course_id AND school_id = p_school_id
    ) THEN
        RAISE EXCEPTION 'COURSE_NOT_FOUND';
    END IF;

    IF p_stimulus_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM question_stimuli WHERE id = p_stimulus_id AND school_id = p_school_id
    ) THEN
        RAISE EXCEPTION 'STIMULUS_NOT_FOUND';
    END IF;

    IF p_question_type NOT IN ('mcq', 'theory') THEN
        RAISE EXCEPTION 'INVALID_QUESTION_TYPE';
    END IF;
    IF btrim(COALESCE(p_plain_text, '')) = ''
       AND jsonb_array_length(COALESCE(p_content_blocks, '[]'::jsonb)) = 0 THEN
        RAISE EXCEPTION 'QUESTION_CONTENT_REQUIRED';
    END IF;
    IF p_marks IS NULL OR p_marks <= 0 THEN
        RAISE EXCEPTION 'INVALID_MARKS';
    END IF;
    IF jsonb_typeof(COALESCE(p_options, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'OPTIONS_MUST_BE_ARRAY';
    END IF;
    IF p_question_type = 'mcq' AND (
        jsonb_array_length(COALESCE(p_options, '[]'::jsonb)) NOT BETWEEN 2 AND 6
        OR (SELECT count(*) FROM jsonb_array_elements(COALESCE(p_options, '[]'::jsonb)) item
            WHERE COALESCE((item ->> 'is_correct')::BOOLEAN, false)) <> 1
    ) THEN
        RAISE EXCEPTION 'INVALID_MCQ_OPTIONS';
    END IF;
    IF p_question_type = 'theory'
       AND jsonb_array_length(COALESCE(p_options, '[]'::jsonb)) <> 0 THEN
        RAISE EXCEPTION 'THEORY_CANNOT_HAVE_OPTIONS';
    END IF;

    INSERT INTO bank_questions (
        school_id, bank_id, author_id, course_id, subject_name, topic, subtopic,
        question_type, search_text
    ) VALUES (
        p_school_id, p_bank_id, p_author_id, p_course_id,
        NULLIF(btrim(p_subject_name), ''), NULLIF(btrim(p_topic), ''),
        NULLIF(btrim(p_subtopic), ''), p_question_type, btrim(COALESCE(p_plain_text, ''))
    ) RETURNING id INTO v_question_id;

    INSERT INTO bank_question_versions (
        school_id, question_id, version_number, created_by, stimulus_id,
        plain_text, content_blocks, explanation_blocks, grading_rubric_blocks, marks
    ) VALUES (
        p_school_id, v_question_id, 1, p_author_id, p_stimulus_id,
        btrim(COALESCE(p_plain_text, '')),
        COALESCE(p_content_blocks, '[]'::jsonb),
        COALESCE(p_explanation_blocks, '[]'::jsonb),
        COALESCE(p_grading_rubric_blocks, '[]'::jsonb), p_marks
    ) RETURNING id INTO v_version_id;

    FOR v_option IN SELECT value FROM jsonb_array_elements(COALESCE(p_options, '[]'::jsonb))
    LOOP
        INSERT INTO bank_question_option_versions (
            school_id, question_version_id, plain_text, content_blocks, is_correct, order_index
        ) VALUES (
            p_school_id, v_version_id,
            btrim(COALESCE(v_option ->> 'plain_text', '')),
            COALESCE(v_option -> 'content_blocks', '[]'::jsonb),
            COALESCE((v_option ->> 'is_correct')::BOOLEAN, false), v_order
        );
        v_order := v_order + 1;
    END LOOP;

    UPDATE bank_questions SET current_version_id = v_version_id
    WHERE id = v_question_id AND school_id = p_school_id;

    RETURN QUERY SELECT v_question_id, v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION revise_bank_question_versioned(
    p_school_id UUID,
    p_question_id UUID,
    p_editor_id UUID,
    p_course_id UUID,
    p_subject_name TEXT,
    p_topic TEXT,
    p_subtopic TEXT,
    p_plain_text TEXT,
    p_content_blocks JSONB,
    p_explanation_blocks JSONB,
    p_grading_rubric_blocks JSONB,
    p_marks NUMERIC,
    p_stimulus_id UUID,
    p_options JSONB
)
RETURNS TABLE(question_id UUID, version_id UUID, version_number INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_question bank_questions%ROWTYPE;
    v_version_id UUID;
    v_version_number INTEGER;
    v_option JSONB;
    v_order INTEGER := 0;
BEGIN
    SELECT * INTO v_question FROM bank_questions
    WHERE id = p_question_id AND school_id = p_school_id AND archived_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'QUESTION_NOT_FOUND'; END IF;

    IF p_course_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM courses WHERE id = p_course_id AND school_id = p_school_id
    ) THEN RAISE EXCEPTION 'COURSE_NOT_FOUND'; END IF;
    IF p_stimulus_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM question_stimuli WHERE id = p_stimulus_id AND school_id = p_school_id
    ) THEN RAISE EXCEPTION 'STIMULUS_NOT_FOUND'; END IF;
    IF btrim(COALESCE(p_plain_text, '')) = ''
       AND jsonb_array_length(COALESCE(p_content_blocks, '[]'::jsonb)) = 0 THEN
        RAISE EXCEPTION 'QUESTION_CONTENT_REQUIRED';
    END IF;
    IF p_marks IS NULL OR p_marks <= 0 THEN RAISE EXCEPTION 'INVALID_MARKS'; END IF;
    IF jsonb_typeof(COALESCE(p_options, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'OPTIONS_MUST_BE_ARRAY';
    END IF;
    IF v_question.question_type = 'mcq' AND (
        jsonb_array_length(COALESCE(p_options, '[]'::jsonb)) NOT BETWEEN 2 AND 6
        OR (SELECT count(*) FROM jsonb_array_elements(COALESCE(p_options, '[]'::jsonb)) item
            WHERE COALESCE((item ->> 'is_correct')::BOOLEAN, false)) <> 1
    ) THEN RAISE EXCEPTION 'INVALID_MCQ_OPTIONS'; END IF;
    IF v_question.question_type = 'theory'
       AND jsonb_array_length(COALESCE(p_options, '[]'::jsonb)) <> 0 THEN
        RAISE EXCEPTION 'THEORY_CANNOT_HAVE_OPTIONS';
    END IF;

    SELECT COALESCE(max(bqv.version_number), 0) + 1 INTO v_version_number
    FROM bank_question_versions bqv WHERE bqv.question_id = p_question_id;

    INSERT INTO bank_question_versions (
        school_id, question_id, version_number, created_by, stimulus_id,
        plain_text, content_blocks, explanation_blocks, grading_rubric_blocks, marks
    ) VALUES (
        p_school_id, p_question_id, v_version_number, p_editor_id, p_stimulus_id,
        btrim(COALESCE(p_plain_text, '')), COALESCE(p_content_blocks, '[]'::jsonb),
        COALESCE(p_explanation_blocks, '[]'::jsonb),
        COALESCE(p_grading_rubric_blocks, '[]'::jsonb), p_marks
    ) RETURNING id INTO v_version_id;

    FOR v_option IN SELECT value FROM jsonb_array_elements(COALESCE(p_options, '[]'::jsonb))
    LOOP
        INSERT INTO bank_question_option_versions (
            school_id, question_version_id, plain_text, content_blocks, is_correct, order_index
        ) VALUES (
            p_school_id, v_version_id, btrim(COALESCE(v_option ->> 'plain_text', '')),
            COALESCE(v_option -> 'content_blocks', '[]'::jsonb),
            COALESCE((v_option ->> 'is_correct')::BOOLEAN, false), v_order
        );
        v_order := v_order + 1;
    END LOOP;

    UPDATE bank_questions SET
        current_version_id = v_version_id,
        course_id = p_course_id,
        subject_name = NULLIF(btrim(p_subject_name), ''),
        topic = NULLIF(btrim(p_topic), ''),
        subtopic = NULLIF(btrim(p_subtopic), ''),
        search_text = btrim(COALESCE(p_plain_text, ''))
    WHERE id = p_question_id AND school_id = p_school_id;

    RETURN QUERY SELECT p_question_id, v_version_id, v_version_number;
END;
$$;

REVOKE ALL ON FUNCTION create_bank_question_versioned(
    UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB,
    NUMERIC, UUID, JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION revise_bank_question_versioned(
    UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB,
    NUMERIC, UUID, JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION create_bank_question_versioned(
    UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB,
    NUMERIC, UUID, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION revise_bank_question_versioned(
    UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB,
    NUMERIC, UUID, JSONB
) TO service_role;
