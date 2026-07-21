-- Make payment confirmation effects atomic and safe under Paystack retries.
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrolments_payment_id ON enrolments(payment_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_event_recipient
ON notifications(user_id, type, related_entity_type, related_entity_id);

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

REVOKE ALL ON FUNCTION confirm_student_payment(TEXT, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_student_payment(TEXT, TEXT, BIGINT) TO service_role;

