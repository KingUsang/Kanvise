-- Onboarding answers (02 ONB-08, ONB-09; 20 DM-14). Runs with `supabase test db` in CI.
BEGIN;

SELECT plan(14);

INSERT INTO public.schools (id, name, slug)
VALUES
  ('00000000-0000-4000-8000-0000000d5a01', 'Onboarding one', 'onboarding-one'),
  ('00000000-0000-4000-8000-0000000d5a02', 'Onboarding two', 'onboarding-two');

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.account_onboarding_answers'::regclass), 'account_onboarding_answers has RLS on');
SELECT ok(NOT has_table_privilege('authenticated', 'public.account_onboarding_answers', 'SELECT,INSERT,UPDATE,DELETE'), 'authenticated has no access');
SELECT ok(NOT has_table_privilege('anon', 'public.account_onboarding_answers', 'SELECT,INSERT,UPDATE,DELETE'), 'anon has no access');
SELECT ok(has_table_privilege('service_role', 'public.account_onboarding_answers', 'SELECT,INSERT,UPDATE'), 'service_role can read and write');

-- An empty insert takes the ONB-09 defaults.
INSERT INTO public.account_onboarding_answers (school_id) VALUES ('00000000-0000-4000-8000-0000000d5a01');
SELECT is((SELECT teaching_mode FROM public.account_onboarding_answers WHERE school_id = '00000000-0000-4000-8000-0000000d5a01'), 'solo', 'default is on my own');
SELECT is((SELECT audience || '/' || class_format FROM public.account_onboarding_answers WHERE school_id = '00000000-0000-4000-8000-0000000d5a01'), 'both/both', 'default audience and format are both');
SELECT is((SELECT subjects FROM public.account_onboarding_answers WHERE school_id = '00000000-0000-4000-8000-0000000d5a01'), '{}'::text[], 'default subjects are none');
SELECT is((SELECT has_students FROM public.account_onboarding_answers WHERE school_id = '00000000-0000-4000-8000-0000000d5a01'), false, 'default is no students yet');

-- One row per account.
SELECT throws_ok($$
  INSERT INTO public.account_onboarding_answers (school_id) VALUES ('00000000-0000-4000-8000-0000000d5a01')
$$, '23505', NULL, 'an account has one set of answers');

-- Allowed values only.
SELECT throws_ok($$
  INSERT INTO public.account_onboarding_answers (school_id, teaching_mode) VALUES ('00000000-0000-4000-8000-0000000d5a02', 'crowd')
$$, '23514', NULL, 'teaching_mode is solo or team');
SELECT throws_ok($$
  INSERT INTO public.account_onboarding_answers (school_id, audience) VALUES ('00000000-0000-4000-8000-0000000d5a02', 'pets')
$$, '23514', NULL, 'audience is limited to the three answers');
SELECT throws_ok($$
  INSERT INTO public.account_onboarding_answers (school_id, subjects)
  VALUES ('00000000-0000-4000-8000-0000000d5a02', ARRAY['a','b','c','d','e','f','g','h','i','j','k'])
$$, '23514', NULL, 'at most ten subjects');
SELECT throws_ok($$
  INSERT INTO public.account_onboarding_answers (school_id, skipped_steps) VALUES ('00000000-0000-4000-8000-0000000d5a02', ARRAY['add_students'])
$$, '23514', NULL, 'only the course plan step can be skipped');

-- Answers go with the account.
DELETE FROM public.schools WHERE id = '00000000-0000-4000-8000-0000000d5a01';
SELECT is((SELECT count(*)::int FROM public.account_onboarding_answers WHERE school_id = '00000000-0000-4000-8000-0000000d5a01'), 0, 'deleting the account deletes its answers');

SELECT * FROM finish();
ROLLBACK;
