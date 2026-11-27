-- Round 8B group B.
--
-- DEV-QBK-009: bind question image media to the bank that owns the question.
-- The earlier trigger function only required a ready media row in the same
-- account, so a Tutor could embed another bank's private image. The object key
-- convention is schools/<school>/private/question_media/<bank>/..., which the
-- API already enforces; this makes the database enforce it as well. Existing
-- bindings are not rewritten.
CREATE OR REPLACE FUNCTION public.bind_question_block_media(
    p_school_id UUID,
    p_question_version_id UUID,
    p_blocks JSONB,
    p_usage_prefix TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_block JSONB;
    v_ordinality BIGINT;
    v_media_id UUID;
    v_bank_id UUID;
BEGIN
    SELECT bq.bank_id INTO v_bank_id
    FROM bank_question_versions bqv
    JOIN bank_questions bq ON bq.id = bqv.question_id
    WHERE bqv.id = p_question_version_id;

    FOR v_block, v_ordinality IN
        SELECT value, ordinality
        FROM jsonb_array_elements(COALESCE(p_blocks, '[]'::jsonb)) WITH ORDINALITY
    LOOP
        IF v_block ->> 'type' = 'image' THEN
            BEGIN
                v_media_id := (v_block ->> 'media_id')::UUID;
            EXCEPTION WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'INVALID_QUESTION_MEDIA_ID';
            END;
            IF NOT EXISTS (
                SELECT 1 FROM question_media
                WHERE id = v_media_id AND school_id = p_school_id
                  AND processing_status = 'ready'
            ) THEN
                RAISE EXCEPTION 'QUESTION_MEDIA_NOT_READY';
            END IF;
            IF v_bank_id IS NULL OR NOT EXISTS (
                SELECT 1 FROM question_media
                WHERE id = v_media_id AND school_id = p_school_id
                  AND left(storage_key, length('schools/' || p_school_id::text || '/private/question_media/' || v_bank_id::text || '/'))
                      = 'schools/' || p_school_id::text || '/private/question_media/' || v_bank_id::text || '/'
            ) THEN
                RAISE EXCEPTION 'QUESTION_MEDIA_WRONG_BANK';
            END IF;
            INSERT INTO bank_question_version_media (
                school_id, question_version_id, media_id, usage_key
            ) VALUES (
                p_school_id, p_question_version_id, v_media_id,
                p_usage_prefix || ':' || v_ordinality
            );
        END IF;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.bind_question_block_media(UUID, UUID, JSONB, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_question_block_media(UUID, UUID, JSONB, TEXT) TO service_role;
