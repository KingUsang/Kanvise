create table public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.user_profiles(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  kind text not null check (kind in ('bug', 'feature')),
  severity text check (severity in ('blocking', 'major', 'minor')),
  description text not null check (char_length(description) between 1 and 4000),
  attempted_action text,
  page_url text,
  user_agent text,
  sentry_event_id text,
  screenshot_key text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  receipt_sent_at timestamptz,
  resolved_at timestamptz,
  resolution_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index feedback_reports_open_created_at_idx on public.feedback_reports (status, created_at desc);
create index feedback_reports_reporter_id_idx on public.feedback_reports (reporter_id, created_at desc);
alter table public.feedback_reports enable row level security;
