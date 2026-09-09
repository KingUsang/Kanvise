-- Shared, atomic daily provider usage counters for multi-instance email failover.
CREATE TABLE public.email_provider_daily_usage (
    provider TEXT NOT NULL CHECK (provider IN ('resend', 'brevo', 'mailjet')),
    usage_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
    attempted_recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (attempted_recipient_count >= 0),
    sent_recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (sent_recipient_count >= 0),
    failed_recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_recipient_count >= 0),
    quota_failure_count INTEGER NOT NULL DEFAULT 0 CHECK (quota_failure_count >= 0),
    cooldown_until TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, usage_date)
);

ALTER TABLE public.email_provider_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_provider_daily_usage FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.email_provider_daily_usage TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_email_provider_capacity(
    p_provider TEXT,
    p_daily_limit INTEGER,
    p_threshold_percent INTEGER,
    p_recipient_count INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    usage_row public.email_provider_daily_usage%ROWTYPE;
    threshold_count INTEGER;
BEGIN
    IF p_provider NOT IN ('resend', 'brevo', 'mailjet') THEN
        RAISE EXCEPTION 'Unsupported email provider';
    END IF;
    IF p_daily_limit < 1 OR p_threshold_percent < 1 OR p_threshold_percent > 100 OR p_recipient_count < 1 THEN
        RAISE EXCEPTION 'Invalid provider capacity parameters';
    END IF;

    threshold_count := GREATEST(1, FLOOR(p_daily_limit * p_threshold_percent / 100.0)::INTEGER);

    INSERT INTO public.email_provider_daily_usage (provider, usage_date)
    VALUES (p_provider, (now() AT TIME ZONE 'UTC')::date)
    ON CONFLICT (provider, usage_date) DO NOTHING;

    SELECT * INTO usage_row
    FROM public.email_provider_daily_usage
    WHERE provider = p_provider
      AND usage_date = (now() AT TIME ZONE 'UTC')::date
    FOR UPDATE;

    IF usage_row.cooldown_until IS NOT NULL AND usage_row.cooldown_until > now() THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'cooldown',
            'used', usage_row.attempted_recipient_count,
            'threshold', threshold_count
        );
    END IF;

    IF usage_row.attempted_recipient_count + p_recipient_count > threshold_count THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'threshold',
            'used', usage_row.attempted_recipient_count,
            'threshold', threshold_count
        );
    END IF;

    UPDATE public.email_provider_daily_usage
    SET attempted_recipient_count = attempted_recipient_count + p_recipient_count,
        updated_at = now()
    WHERE provider = p_provider
      AND usage_date = (now() AT TIME ZONE 'UTC')::date;

    RETURN jsonb_build_object(
        'allowed', true,
        'reason', 'reserved',
        'used', usage_row.attempted_recipient_count + p_recipient_count,
        'threshold', threshold_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_email_provider_result(
    p_provider TEXT,
    p_recipient_count INTEGER,
    p_succeeded BOOLEAN,
    p_quota_failure BOOLEAN DEFAULT false,
    p_cooldown_until TIMESTAMPTZ DEFAULT NULL,
    p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.email_provider_daily_usage
    SET sent_recipient_count = sent_recipient_count + CASE WHEN p_succeeded THEN p_recipient_count ELSE 0 END,
        failed_recipient_count = failed_recipient_count + CASE WHEN p_succeeded THEN 0 ELSE p_recipient_count END,
        quota_failure_count = quota_failure_count + CASE WHEN p_quota_failure THEN 1 ELSE 0 END,
        cooldown_until = CASE
            WHEN p_succeeded THEN NULL
            WHEN p_cooldown_until IS NOT NULL THEN GREATEST(COALESCE(cooldown_until, p_cooldown_until), p_cooldown_until)
            ELSE cooldown_until
        END,
        last_error = CASE WHEN p_succeeded THEN NULL ELSE LEFT(p_error, 500) END,
        updated_at = now()
    WHERE provider = p_provider
      AND usage_date = (now() AT TIME ZONE 'UTC')::date;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_email_provider_capacity(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_email_provider_result(TEXT, INTEGER, BOOLEAN, BOOLEAN, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_email_provider_capacity(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_email_provider_result(TEXT, INTEGER, BOOLEAN, BOOLEAN, TIMESTAMPTZ, TEXT) TO service_role;
