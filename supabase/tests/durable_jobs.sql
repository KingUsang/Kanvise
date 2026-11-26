-- Slice 5: durable job queue, scheduler leases and delivery claims.
-- Runs with `supabase test db` in CI.
BEGIN;

SELECT plan(18);

SELECT has_table('public', 'durable_jobs', 'durable_jobs exists');
SELECT has_table('public', 'scheduler_leases', 'scheduler_leases exists');

-- enqueue: idempotent while active.
SELECT lives_ok($$SELECT public.enqueue_durable_job('t', 'k1', '{}'::jsonb, now(), 2)$$, 'enqueue creates a job');
SELECT lives_ok($$SELECT public.enqueue_durable_job('t', 'k1', '{}'::jsonb, now(), 2)$$, 'enqueue of an active key is a no-op');
SELECT is((SELECT count(*)::int FROM public.durable_jobs WHERE dedupe_key = 'k1'), 1, 'one row per dedupe key');

-- claim: attempts increment and the job is leased.
SELECT is((SELECT count(*)::int FROM public.claim_durable_jobs(ARRAY['t'], 'w1', 5, 300)), 1, 'first worker claims the job');
SELECT is((SELECT attempts FROM public.durable_jobs WHERE dedupe_key = 'k1'), 1, 'claim increments attempts');
SELECT is((SELECT count(*)::int FROM public.claim_durable_jobs(ARRAY['t'], 'w2', 5, 300)), 0, 'second worker cannot claim a leased job');
SELECT is((SELECT count(*)::int FROM public.claim_durable_jobs(ARRAY['other'], 'w2', 5, 300)), 0, 'claim ignores other job types');

-- extend and complete are bound to the holder.
SELECT ok(public.extend_durable_job_lease((SELECT id FROM public.durable_jobs WHERE dedupe_key = 'k1'), 'w1', 300), 'holder extends its lease');
SELECT ok(NOT public.complete_durable_job((SELECT id FROM public.durable_jobs WHERE dedupe_key = 'k1'), 'w2'), 'non-holder cannot complete');

-- expired lease is taken over; the last attempt then fails the job.
UPDATE public.durable_jobs SET locked_until = now() - interval '1 minute' WHERE dedupe_key = 'k1';
SELECT is((SELECT count(*)::int FROM public.claim_durable_jobs(ARRAY['t'], 'w2', 5, 300)), 1, 'expired lease is taken over');
UPDATE public.durable_jobs SET locked_until = now() - interval '1 minute' WHERE dedupe_key = 'k1';
SELECT is((SELECT count(*)::int FROM public.claim_durable_jobs(ARRAY['t'], 'w3', 5, 300)), 0, 'exhausted job is not claimed again');
SELECT is((SELECT status FROM public.durable_jobs WHERE dedupe_key = 'k1'), 'failed', 'exhausted job becomes failed');

-- re-arm: a freshly failed job is not reset, an old one is.
SELECT public.enqueue_durable_job('t', 'k1', '{}'::jsonb, now(), 2);
SELECT is((SELECT status FROM public.durable_jobs WHERE dedupe_key = 'k1'), 'failed', 'recently failed job is not re-armed');
UPDATE public.durable_jobs SET updated_at = now() - interval '7 hours' WHERE dedupe_key = 'k1';
SELECT public.enqueue_durable_job('t', 'k1', '{}'::jsonb, now(), 2);
SELECT is((SELECT status || attempts FROM public.durable_jobs WHERE dedupe_key = 'k1'), 'pending0', 'old failed job is re-armed with attempts reset');

-- scheduler lease: one holder at a time, takeover after expiry.
SELECT ok(public.acquire_scheduler_lease('lease-a', 'h1', 60) AND NOT public.acquire_scheduler_lease('lease-a', 'h2', 60), 'second holder is refused while the lease is live');
UPDATE public.scheduler_leases SET expires_at = now() - interval '1 second' WHERE name = 'lease-a';
SELECT ok(public.acquire_scheduler_lease('lease-a', 'h2', 60), 'expired lease can be taken over');

SELECT * FROM finish();
ROLLBACK;
