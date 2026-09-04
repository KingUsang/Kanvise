-- Spec 06 §2.3 step 12: a student's school_id is set at the point of first paid
-- enrolment. Marketplace purchases (confirm_marketplace_payment) intentionally
-- never touch school_id — a null school remains the marketplace-only identity.
CREATE OR REPLACE FUNCTION confirm_student_payment(
    p_paystack_reference TEXT,
    p_paystack_transaction_id TEXT,
    p_amount_kobo BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment payments%ROWTYPE;
    v_enrolment enrolments%ROWTYPE;
    v_student user_profiles%ROWTYPE;
    v_school schools%ROWTYPE;
    v_target_name TEXT;
    v_already_processed BOOLEAN;
BEGIN
    SELECT * INTO v_payment
    FROM payments
    WHERE paystack_reference = p_paystack_reference
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_payment.status = 'failed' THEN
        RAISE EXCEPTION 'PAYMENT_ALREADY_FAILED' USING ERRCODE = 'P0001';
    END IF;

    IF ROUND(v_payment.amount * 100)::BIGINT <> p_amount_kobo THEN
        RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH' USING ERRCODE = 'P0001';
    END IF;

    v_already_processed := v_payment.status = 'successful';

    IF NOT v_already_processed THEN
        UPDATE payments
        SET status = 'successful',
            paystack_transaction_id = p_paystack_transaction_id,
            paid_at = now(),
            updated_at = now()
        WHERE id = v_payment.id
        RETURNING * INTO v_payment;
    END IF;

    INSERT INTO enrolments (
        school_id, student_id, programme_id, sub_programme_id, course_id, payment_id
    ) VALUES (
        v_payment.school_id, v_payment.student_id, v_payment.programme_id,
        v_payment.sub_programme_id, v_payment.course_id, v_payment.id
    )
    ON CONFLICT (payment_id) DO UPDATE SET payment_id = EXCLUDED.payment_id
    RETURNING * INTO v_enrolment;

    -- First centre enrolment adopts the student into the school. The IS NULL
    -- guard keeps one-school-per-student: an existing membership is never
    -- overwritten (cross-school enrolment is rejected upstream).
    UPDATE user_profiles
    SET school_id = v_payment.school_id,
        updated_at = now()
    WHERE id = v_payment.student_id
      AND role = 'student'
      AND school_id IS NULL;

    INSERT INTO notifications (school_id, user_id, type, title, body, related_entity_type, related_entity_id)
    VALUES
      (v_payment.school_id, v_payment.student_id, 'payment_confirmed', 'Payment confirmed',
       'Your payment has been confirmed.', 'payment', v_payment.id),
      (v_payment.school_id, v_payment.student_id, 'enrolment_confirmed', 'Enrolment confirmed',
       'Your access is ready.', 'enrolment', v_enrolment.id)
    ON CONFLICT (user_id, type, related_entity_type, related_entity_id) DO NOTHING;

    SELECT * INTO v_student FROM user_profiles WHERE id = v_payment.student_id;
    SELECT * INTO v_school FROM schools WHERE id = v_payment.school_id;

    SELECT CASE
      WHEN v_payment.programme_id IS NOT NULL THEN (SELECT name FROM programmes WHERE id = v_payment.programme_id)
      WHEN v_payment.sub_programme_id IS NOT NULL THEN (SELECT name FROM sub_programmes WHERE id = v_payment.sub_programme_id)
      ELSE (SELECT name FROM courses WHERE id = v_payment.course_id)
    END INTO v_target_name;

    RETURN jsonb_build_object(
      'already_processed', v_already_processed,
      'payment_id', v_payment.id,
      'enrolment_id', v_enrolment.id,
      'school_id', v_payment.school_id,
      'school_name', v_school.name,
      'student_id', v_payment.student_id,
      'student_auth_id', v_student.supabase_auth_id,
      'student_school_id', v_student.school_id,
      'student_email', v_student.email,
      'student_first_name', v_student.first_name,
      'target_name', v_target_name,
      'amount', v_payment.amount,
      'currency', v_payment.currency,
      'paystack_reference', v_payment.paystack_reference,
      'paid_at', v_payment.paid_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_student_payment(TEXT, TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_student_payment(TEXT, TEXT, BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_student_payment(TEXT, TEXT, BIGINT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_student_payment(TEXT, TEXT, BIGINT) TO service_role;

-- Backfill: students who already paid for centre learning but were left with a
-- null school_id (and therefore saw the marketplace dashboard).
UPDATE user_profiles up
SET school_id = e.school_id,
    updated_at = now()
FROM (
    SELECT DISTINCT ON (student_id) student_id, school_id
    FROM enrolments
    ORDER BY student_id, enrolled_at ASC
) e
WHERE up.id = e.student_id
  AND up.role = 'student'
  AND up.school_id IS NULL;

-- Mirror the corrected school into JWT claims so the API fast path stops
-- serving the stale null school after the next token refresh.
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('school_id', up.school_id)
FROM user_profiles up
WHERE up.supabase_auth_id = u.id
  AND up.role = 'student'
  AND up.school_id IS NOT NULL
  AND (u.raw_app_meta_data ->> 'school_id') IS NULL;
