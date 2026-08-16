CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE CHECK (length(endpoint) BETWEEN 1 AND 4096 AND endpoint LIKE 'https://%'),
  p256dh TEXT NOT NULL CHECK (length(p256dh) BETWEEN 1 AND 512),
  auth TEXT NOT NULL CHECK (length(auth) BETWEEN 1 AND 256),
  expiration_time TIMESTAMPTZ,
  user_agent TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 512)
);

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions(user_id);
CREATE INDEX push_subscriptions_school_id_idx ON public.push_subscriptions(school_id);

CREATE TABLE public.push_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 1024),
  subscription_id UUID NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'live_class_reminder', 'assignment_deadline', 'mock_published',
    'submission_graded', 'mock_fully_graded', 'class_cancelled'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT CHECK (last_error IS NULL OR length(last_error) <= 500),
  sent_at TIMESTAMPTZ
);

CREATE INDEX push_deliveries_subscription_id_idx ON public.push_deliveries(subscription_id);
CREATE INDEX push_deliveries_user_status_idx ON public.push_deliveries(user_id, status);
CREATE INDEX push_deliveries_school_created_idx ON public.push_deliveries(school_id, created_at DESC);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.push_subscriptions, public.push_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.push_subscriptions, public.push_deliveries TO service_role;

COMMENT ON TABLE public.push_subscriptions IS 'Server-owned Web Push subscriptions. Browser clients manage rows only through authenticated API endpoints.';
COMMENT ON TABLE public.push_deliveries IS 'Idempotent delivery ledger for Web Push notification attempts.';
