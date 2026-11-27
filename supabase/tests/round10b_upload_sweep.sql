-- Round 10B: sweep of consumed upload intents with no registered row (DEV-UPL-003).
-- Runs with `supabase test db` in CI.
BEGIN;

SELECT plan(6);

INSERT INTO public.upload_intents (school_id, requester_id, scope, entity_type, context_id, file_key, content_type, file_size_bytes, status, expires_at, consumed_at)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'private', 'note', 'c1', 'k/old-unregistered', 'application/pdf', 10, 'consumed', now() - interval '3 days', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'private', 'note', 'c1', 'k/recent-unregistered', 'application/pdf', 10, 'consumed', now() - interval '1 hour', now() - interval '30 minutes'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'private', 'note', 'c1', 'k/old-pending', 'application/pdf', 10, 'pending', now() + interval '1 hour', NULL),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'public', 'logo', 'c1', 'k/old-public', 'image/png', 10, 'consumed', now() - interval '3 days', now() - interval '2 days');

SELECT is(public.sweep_unregistered_upload_intents(interval '24 hours', 100), 1, 'only the old unregistered private intent is swept');
SELECT is((SELECT status FROM public.upload_intents WHERE file_key = 'k/old-unregistered'), 'expired', 'swept intent is expired');
SELECT is((SELECT status FROM public.upload_intents WHERE file_key = 'k/recent-unregistered'), 'consumed', 'recent consumed intent keeps its grace window');
SELECT is((SELECT status FROM public.upload_intents WHERE file_key = 'k/old-pending'), 'pending', 'pending intent is untouched');
SELECT is((SELECT status FROM public.upload_intents WHERE file_key = 'k/old-public'), 'consumed', 'public intents are not swept here');
SELECT is((SELECT count(*)::int FROM public.durable_jobs WHERE dedupe_key = 'delete_private_object:k/old-unregistered'), 1, 'object deletion is queued once');

SELECT * FROM finish();
ROLLBACK;
