-- Keep JSON presentation blocks portable while enforcing their media references
-- relationally. A referenced image must be ready and belong to the same school.

ALTER TABLE question_media
    ADD CONSTRAINT question_media_id_school_key UNIQUE (id, school_id);

ALTER TABLE bank_question_version_media
    DROP CONSTRAINT bank_question_version_media_media_id_fkey,
    ADD CONSTRAINT bank_question_version_media_media_school_fkey
        FOREIGN KEY (media_id, school_id)
        REFERENCES question_media(id, school_id) ON DELETE RESTRICT;

ALTER TABLE question_stimulus_media
    DROP CONSTRAINT question_stimulus_media_media_id_fkey,
    ADD CONSTRAINT question_stimulus_media_media_school_fkey
        FOREIGN KEY (media_id, school_id)
        REFERENCES question_media(id, school_id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION bind_question_block_media(
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
BEGIN
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

CREATE OR REPLACE FUNCTION bind_new_question_version_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    PERFORM bind_question_block_media(NEW.school_id, NEW.id, NEW.content_blocks, 'question');
    PERFORM bind_question_block_media(NEW.school_id, NEW.id, NEW.explanation_blocks, 'explanation');
    PERFORM bind_question_block_media(NEW.school_id, NEW.id, NEW.grading_rubric_blocks, 'rubric');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bind_new_question_version_media
    AFTER INSERT ON bank_question_versions
    FOR EACH ROW EXECUTE FUNCTION bind_new_question_version_media();

CREATE OR REPLACE FUNCTION bind_new_question_option_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    PERFORM bind_question_block_media(
        NEW.school_id,
        NEW.question_version_id,
        NEW.content_blocks,
        'option:' || NEW.id::TEXT
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bind_new_question_option_media
    AFTER INSERT ON bank_question_option_versions
    FOR EACH ROW EXECUTE FUNCTION bind_new_question_option_media();

CREATE OR REPLACE FUNCTION sync_question_stimulus_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_block JSONB;
    v_ordinality BIGINT;
    v_media_id UUID;
BEGIN
    DELETE FROM question_stimulus_media WHERE stimulus_id = NEW.id;
    FOR v_block, v_ordinality IN
        SELECT value, ordinality
        FROM jsonb_array_elements(COALESCE(NEW.content_blocks, '[]'::jsonb)) WITH ORDINALITY
    LOOP
        IF v_block ->> 'type' = 'image' THEN
            BEGIN
                v_media_id := (v_block ->> 'media_id')::UUID;
            EXCEPTION WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'INVALID_STIMULUS_MEDIA_ID';
            END;
            IF NOT EXISTS (
                SELECT 1 FROM question_media
                WHERE id = v_media_id AND school_id = NEW.school_id
                  AND processing_status = 'ready'
            ) THEN
                RAISE EXCEPTION 'STIMULUS_MEDIA_NOT_READY';
            END IF;
            INSERT INTO question_stimulus_media (school_id, stimulus_id, media_id, usage_key)
            VALUES (NEW.school_id, NEW.id, v_media_id, 'stimulus:' || v_ordinality);
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_question_stimulus_media
    AFTER INSERT OR UPDATE OF content_blocks ON question_stimuli
    FOR EACH ROW EXECUTE FUNCTION sync_question_stimulus_media();

REVOKE ALL ON FUNCTION bind_question_block_media(UUID, UUID, JSONB, TEXT)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bind_new_question_version_media()
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION bind_new_question_option_media()
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sync_question_stimulus_media()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION bind_question_block_media(UUID, UUID, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION bind_new_question_version_media() TO service_role;
GRANT EXECUTE ON FUNCTION bind_new_question_option_media() TO service_role;
GRANT EXECUTE ON FUNCTION sync_question_stimulus_media() TO service_role;
