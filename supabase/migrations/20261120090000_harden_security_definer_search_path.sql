-- DEV-DB-007: SECURITY DEFINER functions must run with an empty search_path
-- and fully qualified object names (docs/engineering/standards/04).
--
-- Three functions still pinned search_path = public:
--   * public.confirm_student_payment(text, text, bigint)
--   * public.consume_account_invitation(text, text, uuid)
--   * public.prepare_live_class_provider_recovery(uuid, text)
-- Every other SECURITY DEFINER function already uses an empty search_path.
-- SECURITY INVOKER functions that still use search_path = public are not
-- privilege boundaries and are left for a later reviewed migration.
--
-- confirm_student_payment is rewritten with schema-qualified names. Its
-- behaviour is deliberately identical to the version from
-- 20260725120000_set_student_school_on_first_enrolment.sql, including the
-- user_profiles.school_id update that fires the Auth claim sync trigger
-- (see the owner question on DEV-PAY-006). Only the search_path and
-- qualification change.

CREATE OR REPLACE FUNCTION public.confirm_student_payment(
    p_paystack_reference TEXT,
    p_paystack_transaction_id TEXT,
    p_amount_kobo BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payment public.payments%ROWTYPE;
    v_enrolment public.enrolments%ROWTYPE;
    v_student public.user_profiles%ROWTYPE;
    v_school public.schools%ROWTYPE;
    v_target_name TEXT;
    v_already_processed BOOLEAN;
BEGIN
    SELECT * INTO v_payment
    FROM public.payments
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
        UPDATE public.payments
        SET status = 'successful',
            paystack_transaction_id = p_paystack_transaction_id,
            paid_at = now(),
            updated_at = now()
        WHERE id = v_payment.id
        RETURNING * INTO v_payment;
    END IF;

    INSERT INTO public.enrolments (
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
    UPDATE public.user_profiles
    SET school_id = v_payment.school_id,
        updated_at = now()
    WHERE id = v_payment.student_id
      AND role = 'student'
      AND school_id IS NULL;

    INSERT INTO public.notifications (school_id, user_id, type, title, body, related_entity_type, related_entity_id)
    VALUES
      (v_payment.school_id, v_payment.student_id, 'payment_confirmed', 'Payment confirmed',
       'Your payment has been confirmed.', 'payment', v_payment.id),
      (v_payment.school_id, v_payment.student_id, 'enrolment_confirmed', 'Enrolment confirmed',
       'Your access is ready.', 'enrolment', v_enrolment.id)
    ON CONFLICT (user_id, type, related_entity_type, related_entity_id) DO NOTHING;

    SELECT * INTO v_student FROM public.user_profiles WHERE id = v_payment.student_id;
    SELECT * INTO v_school FROM public.schools WHERE id = v_payment.school_id;

    SELECT CASE
      WHEN v_payment.programme_id IS NOT NULL THEN (SELECT name FROM public.programmes WHERE id = v_payment.programme_id)
      WHEN v_payment.sub_programme_id IS NOT NULL THEN (SELECT name FROM public.sub_programmes WHERE id = v_payment.sub_programme_id)
      ELSE (SELECT name FROM public.courses WHERE id = v_payment.course_id)
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

-- Grants are unchanged. CREATE OR REPLACE keeps them, and they are restated
-- so this migration is self-contained.
REVOKE ALL ON FUNCTION public.confirm_student_payment(TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_student_payment(TEXT, TEXT, BIGINT) TO service_role;

-- The bodies of these two functions already qualify every relation with
-- public., so only the search_path setting changes. Operators, now(), lower()
-- and btrim() resolve through pg_catalog, which is always searched.
ALTER FUNCTION public.consume_account_invitation(text, text, uuid)
  SET search_path = '';
ALTER FUNCTION public.prepare_live_class_provider_recovery(uuid, text)
  SET search_path = '';
