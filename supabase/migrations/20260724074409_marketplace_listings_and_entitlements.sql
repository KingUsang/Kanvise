-- Public mock marketplace. These tables are intentionally only reachable through
-- the Hono API's service boundary; browser clients get no direct table/RPC access.

CREATE TABLE mock_marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    creator_school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    creator_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    source_mock_id UUID NOT NULL REFERENCES mock_exams(id) ON DELETE RESTRICT,
    mock_version_id UUID NOT NULL REFERENCES mock_exam_versions(id) ON DELETE RESTRICT,
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 160),
    short_description TEXT NOT NULL DEFAULT '' CHECK (char_length(short_description) <= 600),
    examination TEXT,
    subjects TEXT[] NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('beginner', 'intermediate', 'advanced')),
    instructions TEXT,
    cover_image_key TEXT,
    duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    question_count INTEGER NOT NULL CHECK (question_count > 0),
    total_marks NUMERIC(10,2) NOT NULL CHECK (total_marks >= 0),
    calculator_mode TEXT NOT NULL CHECK (calculator_mode IN ('none', 'basic', 'scientific')),
    result_release_mode TEXT NOT NULL CHECK (result_release_mode IN ('score_only', 'immediately_with_corrections', 'after_close', 'after_theory_grading')),
    attempts_included INTEGER NOT NULL CHECK (attempts_included > 0),
    preview_question_ids UUID[] NOT NULL DEFAULT '{}',
    pricing_type TEXT NOT NULL DEFAULT 'free' CHECK (pricing_type IN ('free', 'paid')),
    price_kobo INTEGER NOT NULL DEFAULT 0 CHECK (price_kobo >= 0),
    currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
    approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'submitted', 'approved', 'rejected')),
    publication_status TEXT NOT NULL DEFAULT 'unlisted' CHECK (publication_status IN ('unlisted', 'listed', 'withdrawn', 'suspended')),
    available_from TIMESTAMPTZ,
    closes_at TIMESTAMPTZ,
    rights_confirmed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    listed_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT,
    CONSTRAINT mock_marketplace_listings_pricing_check CHECK (
        (pricing_type = 'free' AND price_kobo = 0) OR (pricing_type = 'paid' AND price_kobo > 0)
    ),
    CONSTRAINT mock_marketplace_listings_window_check CHECK (
        closes_at IS NULL OR available_from IS NULL OR closes_at > available_from
    ),
    CONSTRAINT mock_marketplace_listings_version_once UNIQUE (mock_version_id)
);

CREATE INDEX idx_marketplace_listings_public ON mock_marketplace_listings
    (publication_status, approval_status, available_from, closes_at);
CREATE INDEX idx_marketplace_listings_creator ON mock_marketplace_listings
    (creator_school_id, creator_user_id, created_at DESC);
CREATE INDEX idx_marketplace_listings_subjects ON mock_marketplace_listings USING GIN (subjects);

CREATE TABLE mock_marketplace_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    listing_id UUID NOT NULL REFERENCES mock_marketplace_listings(id) ON DELETE RESTRICT,
    mock_version_id UUID NOT NULL REFERENCES mock_exam_versions(id) ON DELETE RESTRICT,
    creator_school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    paystack_reference TEXT NOT NULL UNIQUE,
    idempotency_key UUID NOT NULL,
    mock_price_kobo INTEGER NOT NULL CHECK (mock_price_kobo > 0),
    student_processing_fee_kobo INTEGER NOT NULL DEFAULT 0 CHECK (student_processing_fee_kobo >= 0),
    total_charged_kobo INTEGER NOT NULL CHECK (total_charged_kobo > 0),
    platform_fee_kobo INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_kobo >= 0),
    creator_amount_kobo INTEGER NOT NULL CHECK (creator_amount_kobo >= 0),
    currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
    paystack_transaction_id TEXT,
    authorization_url TEXT,
    paid_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    UNIQUE (student_id, idempotency_key),
    CONSTRAINT mock_marketplace_orders_total_check CHECK (total_charged_kobo = mock_price_kobo + student_processing_fee_kobo),
    CONSTRAINT mock_marketplace_orders_split_check CHECK (creator_amount_kobo + platform_fee_kobo <= mock_price_kobo)
);

CREATE INDEX idx_marketplace_orders_student ON mock_marketplace_orders (student_id, created_at DESC);
CREATE INDEX idx_marketplace_orders_listing ON mock_marketplace_orders (listing_id, status);

CREATE TABLE mock_marketplace_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    listing_id UUID NOT NULL REFERENCES mock_marketplace_listings(id) ON DELETE RESTRICT,
    mock_version_id UUID NOT NULL REFERENCES mock_exam_versions(id) ON DELETE RESTRICT,
    source TEXT NOT NULL CHECK (source IN ('free_claim', 'purchase', 'support_grant')),
    order_id UUID REFERENCES mock_marketplace_orders(id) ON DELETE RESTRICT,
    attempts_granted INTEGER NOT NULL CHECK (attempts_granted > 0),
    attempts_consumed INTEGER NOT NULL DEFAULT 0 CHECK (attempts_consumed >= 0 AND attempts_consumed <= attempts_granted),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    revocation_reason TEXT,
    CONSTRAINT mock_marketplace_entitlements_order_check CHECK (
        (source = 'purchase' AND order_id IS NOT NULL) OR (source <> 'purchase')
    )
);

CREATE UNIQUE INDEX uq_marketplace_active_entitlement ON mock_marketplace_entitlements(student_id, mock_version_id)
    WHERE revoked_at IS NULL;
CREATE INDEX idx_marketplace_entitlements_student ON mock_marketplace_entitlements(student_id, granted_at DESC);

CREATE TABLE mock_marketplace_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    order_id UUID NOT NULL REFERENCES mock_marketplace_orders(id) ON DELETE RESTRICT,
    listing_id UUID NOT NULL REFERENCES mock_marketplace_listings(id) ON DELETE RESTRICT,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('payment', 'refund')),
    mock_price_kobo INTEGER NOT NULL,
    student_processing_fee_kobo INTEGER NOT NULL,
    total_charged_kobo INTEGER NOT NULL,
    platform_fee_kobo INTEGER NOT NULL,
    creator_amount_kobo INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
    effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(order_id, entry_type)
);

CREATE TABLE mock_marketplace_creator_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    listing_id UUID NOT NULL REFERENCES mock_marketplace_listings(id) ON DELETE RESTRICT,
    actor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('created', 'submitted', 'approved', 'rejected', 'listed', 'withdrawn')),
    reason TEXT
);

CREATE TABLE mock_marketplace_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    listing_id UUID NOT NULL REFERENCES mock_marketplace_listings(id) ON DELETE RESTRICT,
    reporter_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    reason TEXT NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 1000),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'closed'))
);

CREATE TABLE mock_marketplace_moderation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    listing_id UUID NOT NULL REFERENCES mock_marketplace_listings(id) ON DELETE RESTRICT,
    actor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('suspended', 'restored')),
    reason TEXT NOT NULL
);

ALTER TABLE mock_attempts
    ADD COLUMN marketplace_entitlement_id UUID REFERENCES mock_marketplace_entitlements(id) ON DELETE RESTRICT,
    ADD COLUMN access_source TEXT NOT NULL DEFAULT 'centre_enrolment'
        CHECK (access_source IN ('centre_enrolment', 'marketplace_entitlement'));

CREATE UNIQUE INDEX uq_marketplace_attempt_entitlement_number
    ON mock_attempts(marketplace_entitlement_id, attempt_number)
    WHERE marketplace_entitlement_id IS NOT NULL;

CREATE OR REPLACE FUNCTION claim_free_marketplace_mock(
    p_listing_id UUID, p_student_id UUID, p_now TIMESTAMPTZ
)
RETURNS TABLE(entitlement_id UUID, newly_claimed BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_listing mock_marketplace_listings%ROWTYPE;
    v_entitlement mock_marketplace_entitlements%ROWTYPE;
BEGIN
    SELECT * INTO v_listing FROM mock_marketplace_listings
      WHERE id = p_listing_id FOR UPDATE;
    IF NOT FOUND OR v_listing.approval_status <> 'approved' OR v_listing.publication_status <> 'listed'
      OR v_listing.pricing_type <> 'free'
      OR (v_listing.available_from IS NOT NULL AND p_now < v_listing.available_from)
      OR (v_listing.closes_at IS NOT NULL AND p_now >= v_listing.closes_at) THEN
        RAISE EXCEPTION 'MARKETPLACE_LISTING_NOT_AVAILABLE';
    END IF;
    SELECT * INTO v_entitlement FROM mock_marketplace_entitlements
      WHERE student_id = p_student_id AND mock_version_id = v_listing.mock_version_id AND revoked_at IS NULL
      FOR UPDATE;
    IF FOUND THEN
      RETURN QUERY SELECT v_entitlement.id, false;
      RETURN;
    END IF;
    INSERT INTO mock_marketplace_entitlements(student_id, listing_id, mock_version_id, source, attempts_granted, granted_at)
      VALUES (p_student_id, v_listing.id, v_listing.mock_version_id, 'free_claim', v_listing.attempts_included, p_now)
      RETURNING * INTO v_entitlement;
    RETURN QUERY SELECT v_entitlement.id, true;
END;
$$;

CREATE OR REPLACE FUNCTION start_or_resume_marketplace_mock_attempt(
    p_listing_id UUID, p_student_id UUID, p_now TIMESTAMPTZ
)
RETURNS TABLE(attempt_id UUID, mock_exam_version_id UUID, attempt_number INTEGER, started_at TIMESTAMPTZ, deadline_at TIMESTAMPTZ, resumed BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_listing mock_marketplace_listings%ROWTYPE;
    v_entitlement mock_marketplace_entitlements%ROWTYPE;
    v_mock mock_exams%ROWTYPE;
    v_attempt mock_attempts%ROWTYPE;
    v_deadline TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_listing FROM mock_marketplace_listings WHERE id = p_listing_id FOR SHARE;
    IF NOT FOUND OR v_listing.approval_status <> 'approved' OR v_listing.publication_status <> 'listed'
      OR (v_listing.available_from IS NOT NULL AND p_now < v_listing.available_from)
      OR (v_listing.closes_at IS NOT NULL AND p_now >= v_listing.closes_at) THEN
      RAISE EXCEPTION 'MARKETPLACE_LISTING_NOT_AVAILABLE';
    END IF;
    SELECT * INTO v_entitlement FROM mock_marketplace_entitlements
      WHERE student_id = p_student_id AND listing_id = p_listing_id AND mock_version_id = v_listing.mock_version_id
        AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > p_now)
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MARKETPLACE_ENTITLEMENT_NOT_FOUND'; END IF;
    SELECT * INTO v_mock FROM mock_exams WHERE id = v_listing.source_mock_id AND school_id = v_listing.creator_school_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'MOCK_NOT_AVAILABLE'; END IF;
    SELECT * INTO v_attempt FROM mock_attempts WHERE marketplace_entitlement_id = v_entitlement.id AND status = 'in_progress'
      ORDER BY attempt_number DESC LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      IF v_attempt.deadline_at IS NULL OR p_now < v_attempt.deadline_at THEN
        RETURN QUERY SELECT v_attempt.id, v_listing.mock_version_id, v_attempt.attempt_number, v_attempt.started_at, v_attempt.deadline_at, true;
        RETURN;
      END IF;
      RAISE EXCEPTION 'ATTEMPT_EXPIRED';
    END IF;
    IF v_entitlement.attempts_consumed >= v_entitlement.attempts_granted THEN RAISE EXCEPTION 'ATTEMPT_LIMIT_REACHED'; END IF;
    v_deadline := CASE WHEN COALESCE(v_listing.duration_minutes, 0) > 0 THEN p_now + make_interval(mins => v_listing.duration_minutes) ELSE NULL END;
    INSERT INTO mock_attempts(school_id, mock_exam_id, mock_exam_version_id, student_id, marketplace_entitlement_id, access_source,
      attempt_number, started_at, deadline_at, last_saved_at, status, total_mcq_questions, total_marks)
    VALUES (v_listing.creator_school_id, v_listing.source_mock_id, v_listing.mock_version_id, p_student_id, v_entitlement.id, 'marketplace_entitlement',
      v_entitlement.attempts_consumed + 1, p_now, v_deadline, p_now, 'in_progress',
      (SELECT count(*) FROM mock_version_questions mvq JOIN bank_question_versions bqv ON bqv.id = mvq.question_version_id JOIN bank_questions bq ON bq.id = bqv.question_id
        WHERE mvq.mock_exam_version_id = v_listing.mock_version_id AND bq.question_type = 'mcq'),
      v_listing.total_marks) RETURNING * INTO v_attempt;
    UPDATE mock_marketplace_entitlements SET attempts_consumed = attempts_consumed + 1 WHERE id = v_entitlement.id;
    RETURN QUERY SELECT v_attempt.id, v_listing.mock_version_id, v_attempt.attempt_number, v_attempt.started_at, v_attempt.deadline_at, false;
END;
$$;

ALTER TABLE mock_marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_marketplace_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_marketplace_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_marketplace_creator_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_marketplace_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_marketplace_moderation_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE mock_marketplace_listings, mock_marketplace_orders, mock_marketplace_entitlements,
  mock_marketplace_ledger_entries, mock_marketplace_creator_events, mock_marketplace_reports, mock_marketplace_moderation_events
  FROM anon, authenticated;
REVOKE ALL ON FUNCTION claim_free_marketplace_mock(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION start_or_resume_marketplace_mock_attempt(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_free_marketplace_mock(UUID, UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION start_or_resume_marketplace_mock_attempt(UUID, UUID, TIMESTAMPTZ) TO service_role;
