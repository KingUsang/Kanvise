-- Round 10B: tests for the Round 9B job operations and the atomic class
-- cancellation outbox (DEV-INT-003, DEV-LVC-004). Runs with `supabase test db` in CI.
BEGIN;

SELECT plan(18);

INSERT INTO public.schools (id, name, slug)
VALUES
  ('00000000-0000-4000-8000-000000010b01', 'Round 10B job ops one', 'r10b-jobops-one'),
  ('00000000-0000-4000-8000-000000010b02', 'Round 10B job ops two', 'r10b-jobops-two');
INSERT INTO public.user_profiles (id, supabase_auth_id, school_id, role, kanvise_user_id, first_name, last_name, email)
VALUES (
  '00000000-0000-4000-8000-000000010b10', '00000000-0000-4000-8000-000000010b11',
  '00000000-0000-4000-8000-000000010b01', 'admin', 'R10B-JOBOPS-ADM-1', 'Job', 'Admin', 'r10b-jobops-admin@example.invalid'
);
INSERT INTO public.programmes (id, school_id, name, slug, created_by)
VALUES ('00000000-0000-4000-8000-000000010b20', '00000000-0000-4000-8000-000000010b01',
  'Round 10B class', 'r10b-class', '00000000-0000-4000-8000-000000010b10');
INSERT INTO public.courses (id, school_id, programme_id, name, slug, created_by)
VALUES ('00000000-0000-4000-8000-000000010b30', '00000000-0000-4000-8000-000000010b01',
  '00000000-0000-4000-8000-000000010b20', 'Round 10B subject', 'r10b-subject',
  '00000000-0000-4000-8000-000000010b10');
INSERT INTO public.live_classes (id, school_id, course_id, tutor_id, title, scheduled_at, duration_minutes, created_by)
VALUES
  ('00000000-0000-4000-8000-000000010b40', '00000000-0000-4000-8000-000000010b01',
   '00000000-0000-4000-8000-000000010b30', '00000000-0000-4000-8000-000000010b10',
   'Cancel me', now() + interval '1 day', 60, '00000000-0000-4000-8000-000000010b10'),
  ('00000000-0000-4000-8000-000000010b41', '00000000-0000-4000-8000-000000010b01',
   '00000000-0000-4000-8000-000000010b30', '00000000-0000-4000-8000-000000010b10',
   'Wrong account', now() + interval '1 day', 60, '00000000-0000-4000-8000-000000010b10');

INSERT INTO public.durable_jobs (id, job_type, dedupe_key, status)
VALUES
  ('00000000-0000-4000-8000-000000010b50', 'r10b', 'r10b:pending', 'pending'),
  ('00000000-0000-4000-8000-000000010b51', 'r10b', 'r10b:running', 'running'),
  ('00000000-0000-4000-8000-000000010b52', 'r10b', 'r10b:failed', 'failed');
UPDATE public.durable_jobs SET attempts = 3, last_error = 'boom' WHERE id = '00000000-0000-4000-8000-000000010b52';

-- cancel_durable_job
SELECT is(public.cancel_durable_job('00000000-0000-4000-8000-000000010b50'), true, 'a pending job can be cancelled');
SELECT is((SELECT status FROM public.durable_jobs WHERE id = '00000000-0000-4000-8000-000000010b50'), 'cancelled', 'cancelled job has status cancelled');
SELECT is(public.cancel_durable_job('00000000-0000-4000-8000-000000010b50'), false, 'a cancelled job cannot be cancelled again');
SELECT is(public.cancel_durable_job('00000000-0000-4000-8000-000000010b51'), false, 'a running job cannot be cancelled');
SELECT is(public.cancel_durable_job('00000000-0000-4000-8000-000000010bff'), false, 'an unknown job id returns false');

-- replay_durable_job
SELECT is(public.replay_durable_job('00000000-0000-4000-8000-000000010b52'), true, 'a failed job can be replayed');
SELECT is((SELECT status || attempts::text FROM public.durable_jobs WHERE id = '00000000-0000-4000-8000-000000010b52'), 'pending0', 'replay resets status and attempts');
SELECT is((SELECT last_error FROM public.durable_jobs WHERE id = '00000000-0000-4000-8000-000000010b52'), NULL, 'replay clears the last error');
SELECT is(public.replay_durable_job('00000000-0000-4000-8000-000000010b52'), false, 'a pending job cannot be replayed');
SELECT is(public.replay_durable_job('00000000-0000-4000-8000-000000010b50'), true, 'a cancelled job can be replayed');
SELECT is(public.replay_durable_job('00000000-0000-4000-8000-000000010b51'), false, 'a running job cannot be replayed');

-- cancel_live_class_with_outbox
SELECT is(
  (SELECT status FROM public.cancel_live_class_with_outbox('00000000-0000-4000-8000-000000010b40', '00000000-0000-4000-8000-000000010b01', 'Round 10B', 'Tutor ill')),
  'cancelled',
  'a scheduled class is cancelled and returned'
);
SELECT is(
  (SELECT payload ->> 'reason' FROM public.durable_jobs WHERE dedupe_key = 'notify_class_cancelled:00000000-0000-4000-8000-000000010b40'),
  'Tutor ill',
  'the cancellation notification is queued in the same transaction'
);
SELECT is(
  (SELECT count(*)::int FROM public.cancel_live_class_with_outbox('00000000-0000-4000-8000-000000010b40', '00000000-0000-4000-8000-000000010b01', 'Round 10B', 'Tutor ill')),
  0,
  'cancelling an already cancelled class returns no row'
);
SELECT is(
  (SELECT count(*)::int FROM public.durable_jobs WHERE dedupe_key = 'notify_class_cancelled:00000000-0000-4000-8000-000000010b40'),
  1,
  'a repeated cancellation queues no second job'
);
SELECT is(
  (SELECT count(*)::int FROM public.cancel_live_class_with_outbox('00000000-0000-4000-8000-000000010b41', '00000000-0000-4000-8000-000000010b02', NULL, NULL)),
  0,
  'a class in another account is not cancelled'
);
SELECT is(
  (SELECT status FROM public.live_classes WHERE id = '00000000-0000-4000-8000-000000010b41')
    || (SELECT count(*)::text FROM public.durable_jobs WHERE dedupe_key = 'notify_class_cancelled:00000000-0000-4000-8000-000000010b41'),
  'scheduled0',
  'the other account class stays scheduled with no job'
);

-- privileges
SELECT ok(
  NOT has_function_privilege('anon', 'public.cancel_live_class_with_outbox(uuid, uuid, text, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.cancel_durable_job(uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.replay_durable_job(uuid)', 'EXECUTE'),
  'job operation functions are service_role only'
);

SELECT * FROM finish();
ROLLBACK;
