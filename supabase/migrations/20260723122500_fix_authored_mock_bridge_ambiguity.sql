-- Upgrade databases that briefly received the first bridge definition before
-- its output-column ambiguity was found during fixture verification.
DO $migration$
DECLARE
    v_definition TEXT;
BEGIN
    SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'replace_authored_mock_questions'
      AND pg_get_function_identity_arguments(p.oid) = 'p_school_id uuid, p_mock_exam_id uuid, p_author_id uuid, p_questions jsonb';

    IF v_definition IS NULL THEN
        RAISE EXCEPTION 'replace_authored_mock_questions function is missing';
    END IF;

    v_definition := replace(
        v_definition,
        'DELETE FROM bank_questions' || chr(10) || '    WHERE bank_id = v_bank_id AND school_id = p_school_id',
        'DELETE FROM bank_questions bq' || chr(10) || '    WHERE bq.bank_id = v_bank_id AND bq.school_id = p_school_id'
    );
    v_definition := replace(
        v_definition,
        'SELECT count(*) FROM bank_questions WHERE bank_id = v_bank_id AND question_type = ''mcq''',
        'SELECT count(*) FROM bank_questions bq WHERE bq.bank_id = v_bank_id AND bq.question_type = ''mcq'''
    );
    v_definition := replace(
        v_definition,
        'SELECT count(*) FROM bank_questions WHERE bank_id = v_bank_id AND question_type = ''theory''',
        'SELECT count(*) FROM bank_questions bq WHERE bq.bank_id = v_bank_id AND bq.question_type = ''theory'''
    );

    EXECUTE v_definition;
END;
$migration$;
