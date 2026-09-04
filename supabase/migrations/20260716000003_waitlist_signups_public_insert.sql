-- Waitlist signups table + public insert-only RLS
-- Allows anon/authenticated users to submit waitlist forms without service role key.

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    contact_name TEXT NOT NULL CHECK (length(trim(contact_name)) > 0),
    contact_email TEXT NOT NULL CHECK (length(trim(contact_email)) > 3),
    centre_name TEXT NOT NULL CHECK (length(trim(centre_name)) > 0),
    contact_phone TEXT,
    estimated_student_count INTEGER CHECK (estimated_student_count IS NULL OR estimated_student_count >= 0),
    wants_beta_testing BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_waitlist_signups_contact_email
ON public.waitlist_signups (lower(contact_email));

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert waitlist signups" ON public.waitlist_signups;
CREATE POLICY "Public can insert waitlist signups"
ON public.waitlist_signups
FOR INSERT
TO anon, authenticated
WITH CHECK (
    length(trim(contact_name)) > 0
    AND position('@' in contact_email) > 1
    AND length(trim(centre_name)) > 0
);

REVOKE SELECT, UPDATE, DELETE ON public.waitlist_signups FROM anon, authenticated;
GRANT INSERT ON public.waitlist_signups TO anon, authenticated;

DROP TRIGGER IF EXISTS trg_waitlist_signups_update_timestamp ON public.waitlist_signups;
CREATE TRIGGER trg_waitlist_signups_update_timestamp
BEFORE UPDATE ON public.waitlist_signups
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
