-- Append-only migration for durable, idempotent transactional email delivery.
CREATE TABLE IF NOT EXISTS email_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    idempotency_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    provider_message_id TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_status
ON email_deliveries(status, updated_at);

ALTER TABLE email_deliveries ENABLE ROW LEVEL SECURITY;

