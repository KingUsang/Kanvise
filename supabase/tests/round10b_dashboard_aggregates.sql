-- Round 10B: dashboard aggregates (DEV-DSH-003). Runs with `supabase test db` in CI.
BEGIN;

SELECT plan(4);

SELECT has_function('public', 'dashboard_needs_grading', ARRAY['uuid', 'uuid', 'integer'], 'dashboard_needs_grading exists');
SELECT has_function('public', 'dashboard_pending_submissions', ARRAY['uuid', 'uuid'], 'dashboard_pending_submissions exists');
SELECT is((SELECT count(*)::int FROM public.dashboard_needs_grading('00000000-0000-0000-0000-0000000000f1', NULL, 3)), 0, 'an account with no submissions has nothing to grade');
SELECT is(public.dashboard_pending_submissions('00000000-0000-0000-0000-0000000000f1', NULL), 0, 'an account with no submissions has no pending count');

SELECT * FROM finish();
ROLLBACK;
