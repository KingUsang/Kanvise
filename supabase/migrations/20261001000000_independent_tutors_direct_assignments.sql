-- Independent tutors retain the existing admin capability set, but their
-- tenant is marked independently so product copy and workflows can adapt
-- without creating a second permission model.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'centre'
  CHECK (account_type IN ('centre', 'independent'));

-- Direct assignments intentionally sit beside course assignments. They are
-- not enrolment records and are never queried directly by anonymous clients.
CREATE TABLE IF NOT EXISTS public.direct_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  deadline_at TIMESTAMPTZ NOT NULL,
  attachment_file_key TEXT,
  attachment_file_name TEXT,
  attachment_file_type TEXT,
  attachment_file_size_bytes BIGINT,
  share_token_hash TEXT NOT NULL UNIQUE,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_direct_assignments_tutor
  ON public.direct_assignments(school_id, tutor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_assignments_token
  ON public.direct_assignments(share_token_hash)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.direct_assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  direct_assignment_id UUID NOT NULL REFERENCES public.direct_assignments(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  file_key TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size_bytes BIGINT,
  response_text TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  score NUMERIC(5,2),
  feedback TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.user_profiles(id),
  CHECK (file_key IS NOT NULL OR NULLIF(response_text, '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_direct_assignment_submissions_assignment
  ON public.direct_assignment_submissions(direct_assignment_id, submitted_at DESC);

ALTER TABLE public.direct_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_assignment_submissions ENABLE ROW LEVEL SECURITY;

-- API routes use the service role and enforce tutor/guest token access. Keep
-- exposed PostgREST clients from reading either table directly.
REVOKE ALL ON public.direct_assignments FROM anon, authenticated;
REVOKE ALL ON public.direct_assignment_submissions FROM anon, authenticated;
