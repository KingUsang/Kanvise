-- Kanvise is still in test stage. Remove the experimental marketplace entirely
-- and replace it with direct mock offers that do not require a programme or a
-- single-centre student identity.

-- Marketplace test data and its isolated attempt path are intentionally
-- discarded. Marketplace mocks are test fixtures too.
DROP FUNCTION IF EXISTS public.confirm_marketplace_payment(TEXT, TEXT, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.claim_free_marketplace_mock(UUID, UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.start_or_resume_marketplace_mock_attempt(UUID, UUID, TIMESTAMPTZ);

DROP TABLE IF EXISTS public.mock_marketplace_ledger_entries CASCADE;
DROP TABLE IF EXISTS public.mock_marketplace_creator_events CASCADE;
DROP TABLE IF EXISTS public.mock_marketplace_moderation_events CASCADE;
DROP TABLE IF EXISTS public.mock_marketplace_reports CASCADE;
DROP TABLE IF EXISTS public.mock_marketplace_orders CASCADE;
DROP TABLE IF EXISTS public.mock_marketplace_entitlements CASCADE;
DROP TABLE IF EXISTS public.mock_marketplace_listings CASCADE;

ALTER TABLE public.mock_attempts
  DROP COLUMN IF EXISTS marketplace_entitlement_id,
  DROP COLUMN IF EXISTS access_source;

ALTER TABLE public.mock_exams DROP CONSTRAINT IF EXISTS mock_exams_centre_audience_target_check;
ALTER TABLE public.mock_exams DROP CONSTRAINT IF EXISTS mock_exams_audience_scope_check;
ALTER TABLE public.mock_exams DROP CONSTRAINT IF EXISTS mock_exams_distribution_mode_check;
ALTER TABLE public.mock_exams DROP CONSTRAINT IF EXISTS mock_exams_centre_distribution_requires_course_check;
ALTER TABLE public.mock_exams DROP CONSTRAINT IF EXISTS mock_exams_marketplace_approval_status_check;

CREATE TEMP TABLE deleted_marketplace_mock_ids ON COMMIT DROP AS
SELECT id FROM public.mock_exams
WHERE distribution_mode IN ('marketplace', 'both') OR audience_scope = 'marketplace';

DELETE FROM public.mock_attempt_grants
WHERE mock_exam_version_id IN (
  SELECT version.id FROM public.mock_exam_versions version
  JOIN deleted_marketplace_mock_ids mock ON mock.id = version.mock_exam_id
);
DELETE FROM public.mock_attempts WHERE mock_exam_id IN (SELECT id FROM deleted_marketplace_mock_ids);
DELETE FROM public.mock_version_questions
WHERE mock_exam_version_id IN (
  SELECT version.id FROM public.mock_exam_versions version
  JOIN deleted_marketplace_mock_ids mock ON mock.id = version.mock_exam_id
);
DELETE FROM public.mock_exam_versions WHERE mock_exam_id IN (SELECT id FROM deleted_marketplace_mock_ids);
DELETE FROM public.mock_exams WHERE id IN (SELECT id FROM deleted_marketplace_mock_ids);

DROP INDEX IF EXISTS public.idx_mock_exams_school_distribution_mode;
DROP INDEX IF EXISTS public.idx_mock_exams_marketplace_approval;
ALTER TABLE public.mock_exams
  DROP COLUMN IF EXISTS distribution_mode,
  DROP COLUMN IF EXISTS marketplace_approval_status,
  DROP COLUMN IF EXISTS marketplace_submitted_at,
  DROP COLUMN IF EXISTS marketplace_approved_at,
  DROP COLUMN IF EXISTS marketplace_approved_by,
  DROP COLUMN IF EXISTS marketplace_rejection_reason;

ALTER TABLE public.mock_exams
  ADD CONSTRAINT mock_exams_audience_scope_check
    CHECK (audience_scope IN ('course', 'programme', 'school')),
  ADD CONSTRAINT mock_exams_centre_audience_target_check
    CHECK (
      (audience_scope = 'course' AND course_id IS NOT NULL AND programme_id IS NULL)
      OR (audience_scope = 'programme' AND course_id IS NULL AND programme_id IS NOT NULL)
      OR (audience_scope = 'school' AND course_id IS NULL AND programme_id IS NULL)
    );

-- A student can learn with more than one centre. A membership is distinct from
-- any programme/course enrolment and is never created by a mock purchase.
CREATE TABLE public.student_centre_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  student_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  source TEXT NOT NULL DEFAULT 'enrolment' CHECK (source IN ('enrolment', 'admin_import', 'manual')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (student_id, school_id)
);

CREATE INDEX idx_student_centre_memberships_student
  ON public.student_centre_memberships (student_id, status, school_id);
CREATE INDEX idx_student_centre_memberships_school
  ON public.student_centre_memberships (school_id, status, student_id);

INSERT INTO public.student_centre_memberships (student_id, school_id, source)
SELECT DISTINCT enrolment.student_id, enrolment.school_id, 'enrolment'
FROM public.enrolments enrolment
ON CONFLICT (student_id, school_id) DO NOTHING;

INSERT INTO public.student_centre_memberships (student_id, school_id, source)
SELECT profile.id, profile.school_id, 'manual'
FROM public.user_profiles profile
WHERE profile.role = 'student' AND profile.school_id IS NOT NULL
ON CONFLICT (student_id, school_id) DO NOTHING;

ALTER TABLE public.enrolments
  ADD COLUMN membership_id UUID REFERENCES public.student_centre_memberships(id) ON DELETE RESTRICT;

UPDATE public.enrolments enrolment
SET membership_id = membership.id
FROM public.student_centre_memberships membership
WHERE membership.student_id = enrolment.student_id
  AND membership.school_id = enrolment.school_id
  AND enrolment.membership_id IS NULL;

ALTER TABLE public.enrolments
  ALTER COLUMN membership_id SET NOT NULL;

-- Every enrolment, including a later purchase at another centre, gets its own
-- membership. This keeps the existing payment RPC compatible while removing
-- its former one-centre restriction.
CREATE OR REPLACE FUNCTION public.attach_enrolment_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.membership_id IS NULL THEN
    INSERT INTO public.student_centre_memberships(student_id, school_id, source)
    VALUES (NEW.student_id, NEW.school_id, 'enrolment')
    ON CONFLICT (student_id, school_id) DO UPDATE SET status = 'active', revoked_at = NULL, updated_at = now();
    SELECT id INTO NEW.membership_id FROM public.student_centre_memberships
      WHERE student_id = NEW.student_id AND school_id = NEW.school_id AND status = 'active';
  END IF;
  IF NEW.membership_id IS NULL THEN RAISE EXCEPTION 'ACTIVE_CENTRE_MEMBERSHIP_REQUIRED'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enrolments_attach_membership ON public.enrolments;
CREATE TRIGGER enrolments_attach_membership BEFORE INSERT OR UPDATE OF student_id, school_id, membership_id
  ON public.enrolments FOR EACH ROW EXECUTE FUNCTION public.attach_enrolment_membership();

ALTER TABLE public.student_centre_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_centre_memberships FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_centre_memberships TO service_role;

-- A direct mock offer is the sole public/private distribution surface. It is
-- attached to a frozen mock version so purchases cannot change underneath a
-- student.
CREATE TABLE public.mock_access_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  mock_exam_id UUID NOT NULL REFERENCES public.mock_exams(id) ON DELETE CASCADE,
  mock_exam_version_id UUID NOT NULL REFERENCES public.mock_exam_versions(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  audience_scope TEXT NOT NULL CHECK (audience_scope IN ('course', 'programme', 'school', 'selected_students', 'public_link')),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  programme_id UUID REFERENCES public.programmes(id) ON DELETE CASCADE,
  access_mode TEXT NOT NULL CHECK (access_mode IN ('included', 'free_claim', 'paid', 'access_code', 'admin_grant')),
  price_kobo INTEGER NOT NULL DEFAULT 0 CHECK (price_kobo >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  attempts_included INTEGER NOT NULL DEFAULT 1 CHECK (attempts_included > 0),
  access_code_hash TEXT,
  available_from TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  expires_after_days INTEGER CHECK (expires_after_days IS NULL OR expires_after_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT mock_access_offers_audience_target_check CHECK (
    (audience_scope = 'course' AND course_id IS NOT NULL AND programme_id IS NULL)
    OR (audience_scope = 'programme' AND course_id IS NULL AND programme_id IS NOT NULL)
    OR (audience_scope IN ('school', 'selected_students', 'public_link') AND course_id IS NULL AND programme_id IS NULL)
  ),
  CONSTRAINT mock_access_offers_price_check CHECK (
    (access_mode = 'paid' AND price_kobo > 0) OR (access_mode <> 'paid' AND price_kobo = 0)
  ),
  CONSTRAINT mock_access_offers_window_check CHECK (closes_at IS NULL OR available_from IS NULL OR closes_at > available_from)
);

CREATE INDEX idx_mock_access_offers_version ON public.mock_access_offers (mock_exam_version_id, is_active);
CREATE INDEX idx_mock_access_offers_school ON public.mock_access_offers (school_id, is_active, created_at DESC);

CREATE TABLE public.mock_access_offer_students (
  offer_id UUID NOT NULL REFERENCES public.mock_access_offers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (offer_id, student_id)
);

CREATE TABLE public.mock_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  student_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  offer_id UUID NOT NULL REFERENCES public.mock_access_offers(id) ON DELETE RESTRICT,
  mock_exam_version_id UUID NOT NULL REFERENCES public.mock_exam_versions(id) ON DELETE RESTRICT,
  paystack_reference TEXT NOT NULL UNIQUE,
  idempotency_key UUID NOT NULL,
  amount_kobo INTEGER NOT NULL CHECK (amount_kobo > 0),
  currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
  paystack_transaction_id TEXT,
  authorization_url TEXT,
  paid_at TIMESTAMPTZ,
  UNIQUE (student_id, idempotency_key)
);

CREATE TABLE public.mock_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  student_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  offer_id UUID NOT NULL REFERENCES public.mock_access_offers(id) ON DELETE RESTRICT,
  mock_exam_version_id UUID NOT NULL REFERENCES public.mock_exam_versions(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN ('free_claim', 'purchase', 'admin_grant', 'included')),
  order_id UUID REFERENCES public.mock_orders(id) ON DELETE RESTRICT,
  attempts_granted INTEGER NOT NULL CHECK (attempts_granted > 0),
  attempts_consumed INTEGER NOT NULL DEFAULT 0 CHECK (attempts_consumed BETWEEN 0 AND attempts_granted),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT mock_entitlements_purchase_check CHECK ((source = 'purchase' AND order_id IS NOT NULL) OR source <> 'purchase')
);

CREATE UNIQUE INDEX uq_mock_active_entitlement
  ON public.mock_entitlements (student_id, offer_id, mock_exam_version_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_mock_entitlements_student ON public.mock_entitlements (student_id, granted_at DESC);

ALTER TABLE public.mock_attempts
  ADD COLUMN entitlement_id UUID REFERENCES public.mock_entitlements(id) ON DELETE RESTRICT,
  ADD COLUMN access_source TEXT NOT NULL DEFAULT 'included' CHECK (access_source IN ('included', 'entitlement'));
CREATE UNIQUE INDEX uq_mock_attempt_entitlement_number
  ON public.mock_attempts (entitlement_id, attempt_number) WHERE entitlement_id IS NOT NULL;

ALTER TABLE public.mock_access_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_access_offer_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mock_access_offers, public.mock_access_offer_students, public.mock_orders, public.mock_entitlements FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_access_offers, public.mock_access_offer_students, public.mock_orders, public.mock_entitlements TO service_role;

CREATE OR REPLACE FUNCTION public.claim_free_mock_offer(
  p_offer_id UUID, p_student_id UUID, p_now TIMESTAMPTZ
)
RETURNS TABLE(entitlement_id UUID, newly_claimed BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_offer public.mock_access_offers%ROWTYPE; v_entitlement public.mock_entitlements%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM public.mock_access_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR NOT v_offer.is_active OR v_offer.access_mode <> 'free_claim'
    OR (v_offer.available_from IS NOT NULL AND p_now < v_offer.available_from)
    OR (v_offer.closes_at IS NOT NULL AND p_now >= v_offer.closes_at) THEN
    RAISE EXCEPTION 'MOCK_OFFER_NOT_AVAILABLE';
  END IF;
  SELECT * INTO v_entitlement FROM public.mock_entitlements
    WHERE student_id = p_student_id AND offer_id = v_offer.id AND mock_exam_version_id = v_offer.mock_exam_version_id
      AND revoked_at IS NULL FOR UPDATE;
  IF FOUND THEN RETURN QUERY SELECT v_entitlement.id, false; RETURN; END IF;
  INSERT INTO public.mock_entitlements(student_id, offer_id, mock_exam_version_id, source, attempts_granted, expires_at)
  VALUES (p_student_id, v_offer.id, v_offer.mock_exam_version_id, 'free_claim', v_offer.attempts_included,
    CASE WHEN v_offer.expires_after_days IS NULL THEN NULL ELSE p_now + make_interval(days => v_offer.expires_after_days) END)
  RETURNING * INTO v_entitlement;
  RETURN QUERY SELECT v_entitlement.id, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_or_resume_mock_offer_attempt(
  p_offer_id UUID, p_student_id UUID, p_now TIMESTAMPTZ
)
RETURNS TABLE(attempt_id UUID, mock_exam_version_id UUID, attempt_number INTEGER, started_at TIMESTAMPTZ, deadline_at TIMESTAMPTZ, resumed BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_offer public.mock_access_offers%ROWTYPE; v_entitlement public.mock_entitlements%ROWTYPE;
  v_mock public.mock_exams%ROWTYPE; v_attempt public.mock_attempts%ROWTYPE; v_deadline TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_offer FROM public.mock_access_offers WHERE id = p_offer_id FOR SHARE;
  IF NOT FOUND OR NOT v_offer.is_active OR (v_offer.available_from IS NOT NULL AND p_now < v_offer.available_from)
    OR (v_offer.closes_at IS NOT NULL AND p_now >= v_offer.closes_at) THEN RAISE EXCEPTION 'MOCK_OFFER_NOT_AVAILABLE'; END IF;
  SELECT * INTO v_entitlement FROM public.mock_entitlements WHERE student_id = p_student_id AND offer_id = p_offer_id
    AND mock_exam_version_id = v_offer.mock_exam_version_id AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > p_now) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_ENTITLEMENT_NOT_FOUND'; END IF;
  SELECT * INTO v_mock FROM public.mock_exams WHERE id = v_offer.mock_exam_id AND school_id = v_offer.school_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_NOT_AVAILABLE'; END IF;
  SELECT * INTO v_attempt FROM public.mock_attempts WHERE entitlement_id = v_entitlement.id AND status = 'in_progress'
    ORDER BY attempt_number DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF v_attempt.deadline_at IS NULL OR p_now < v_attempt.deadline_at THEN
      RETURN QUERY SELECT v_attempt.id, v_offer.mock_exam_version_id, v_attempt.attempt_number, v_attempt.started_at, v_attempt.deadline_at, true; RETURN;
    END IF;
    RAISE EXCEPTION 'ATTEMPT_EXPIRED';
  END IF;
  IF v_entitlement.attempts_consumed >= v_entitlement.attempts_granted THEN RAISE EXCEPTION 'ATTEMPT_LIMIT_REACHED'; END IF;
  v_deadline := CASE WHEN COALESCE(v_mock.time_limit_minutes, 0) > 0 THEN p_now + make_interval(mins => v_mock.time_limit_minutes) ELSE NULL END;
  IF v_offer.closes_at IS NOT NULL AND (v_deadline IS NULL OR v_offer.closes_at < v_deadline) THEN v_deadline := v_offer.closes_at; END IF;
  INSERT INTO public.mock_attempts(school_id, mock_exam_id, mock_exam_version_id, student_id, entitlement_id, access_source,
    attempt_number, started_at, deadline_at, last_saved_at, status, total_mcq_questions, total_marks)
  VALUES (v_offer.school_id, v_offer.mock_exam_id, v_offer.mock_exam_version_id, p_student_id, v_entitlement.id, 'entitlement',
    v_entitlement.attempts_consumed + 1, p_now, v_deadline, p_now, 'in_progress',
    (SELECT count(*) FROM public.mock_version_questions mvq JOIN public.bank_question_versions bqv ON bqv.id = mvq.question_version_id
      JOIN public.bank_questions bq ON bq.id = bqv.question_id WHERE mvq.mock_exam_version_id = v_offer.mock_exam_version_id AND bq.question_type = 'mcq'),
    (SELECT total_marks FROM public.mock_exam_versions WHERE id = v_offer.mock_exam_version_id)) RETURNING * INTO v_attempt;
  UPDATE public.mock_entitlements SET attempts_consumed = attempts_consumed + 1 WHERE id = v_entitlement.id;
  RETURN QUERY SELECT v_attempt.id, v_offer.mock_exam_version_id, v_attempt.attempt_number, v_attempt.started_at, v_attempt.deadline_at, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_mock_order_payment(
  p_paystack_reference TEXT, p_paystack_transaction_id TEXT, p_amount_kobo INTEGER, p_now TIMESTAMPTZ
)
RETURNS TABLE(order_id UUID, entitlement_id UUID, already_processed BOOLEAN, student_id UUID, student_email TEXT, student_first_name TEXT, offer_title TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_order public.mock_orders%ROWTYPE; v_offer public.mock_access_offers%ROWTYPE; v_entitlement public.mock_entitlements%ROWTYPE; v_has_entitlement BOOLEAN := false;
BEGIN
  SELECT * INTO v_order FROM public.mock_orders WHERE paystack_reference = p_paystack_reference FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_ORDER_NOT_FOUND'; END IF;
  IF v_order.amount_kobo <> p_amount_kobo THEN RAISE EXCEPTION 'MOCK_ORDER_AMOUNT_MISMATCH'; END IF;
  SELECT * INTO v_offer FROM public.mock_access_offers WHERE id = v_order.offer_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_OFFER_NOT_FOUND'; END IF;
  SELECT * INTO v_entitlement FROM public.mock_entitlements WHERE student_id = v_order.student_id AND offer_id = v_order.offer_id
    AND mock_exam_version_id = v_order.mock_exam_version_id AND revoked_at IS NULL FOR UPDATE;
  v_has_entitlement := FOUND;
  IF v_order.status = 'paid' THEN
    RETURN QUERY SELECT v_order.id, v_entitlement.id, true, v_order.student_id, profile.email, profile.first_name, mock.title
    FROM public.user_profiles profile JOIN public.mock_exams mock ON mock.id = v_offer.mock_exam_id WHERE profile.id = v_order.student_id; RETURN;
  END IF;
  UPDATE public.mock_orders SET status = 'paid', paystack_transaction_id = p_paystack_transaction_id, paid_at = p_now, updated_at = p_now WHERE id = v_order.id;
  IF NOT v_has_entitlement THEN
    INSERT INTO public.mock_entitlements(student_id, offer_id, mock_exam_version_id, source, order_id, attempts_granted, expires_at)
    VALUES (v_order.student_id, v_order.offer_id, v_order.mock_exam_version_id, 'purchase', v_order.id, v_offer.attempts_included,
      CASE WHEN v_offer.expires_after_days IS NULL THEN NULL ELSE p_now + make_interval(days => v_offer.expires_after_days) END)
    RETURNING * INTO v_entitlement;
  END IF;
  RETURN QUERY SELECT v_order.id, v_entitlement.id, false, v_order.student_id, profile.email, profile.first_name, mock.title
  FROM public.user_profiles profile JOIN public.mock_exams mock ON mock.id = v_offer.mock_exam_id WHERE profile.id = v_order.student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_free_mock_offer(UUID, UUID, TIMESTAMPTZ), public.start_or_resume_mock_offer_attempt(UUID, UUID, TIMESTAMPTZ), public.confirm_mock_order_payment(TEXT, TEXT, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_mock_offer(UUID, UUID, TIMESTAMPTZ), public.start_or_resume_mock_offer_attempt(UUID, UUID, TIMESTAMPTZ), public.confirm_mock_order_payment(TEXT, TEXT, INTEGER, TIMESTAMPTZ) TO service_role;
