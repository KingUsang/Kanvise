-- Privacy-preserving, platform-level funnel events for the public Kanvise
-- landing page. The browser cannot access this table directly: the Hono API
-- validates and writes events with the server-side service role.
CREATE TABLE IF NOT EXISTS public.landing_analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_id TEXT NOT NULL CHECK (length(session_id) BETWEEN 16 AND 128),
    event_name TEXT NOT NULL CHECK (
        event_name IN (
            'landing_view',
            'hero_cta_clicked',
            'product_cta_clicked',
            'tool_explored',
            'feature_explored',
            'section_viewed',
            'waitlist_cta_clicked',
            'waitlist_form_started',
            'waitlist_completed',
            'social_clicked'
        )
    ),
    page_path TEXT NOT NULL DEFAULT '/',
    referrer_host TEXT,
    device_type TEXT NOT NULL CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
    event_properties JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_properties) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_landing_analytics_events_created_at
ON public.landing_analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_analytics_events_name_created_at
ON public.landing_analytics_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_analytics_events_session_created_at
ON public.landing_analytics_events (session_id, created_at ASC);

ALTER TABLE public.landing_analytics_events ENABLE ROW LEVEL SECURITY;

-- No public Data API access. All writes and reporting stay behind Hono.
REVOKE ALL ON public.landing_analytics_events FROM anon, authenticated;
GRANT INSERT, SELECT ON public.landing_analytics_events TO service_role;

-- Waitlist positions are calculated chronologically by the API.
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at
ON public.waitlist_signups (created_at ASC);
