-- Round 8B review: setup_programme stamps the fingerprint and teaching mode in
-- the creating transaction and rejects a replay with a different fingerprint.
BEGIN;

SELECT plan(6);

INSERT INTO public.schools (id, name, slug)
VALUES ('00000000-0000-4000-8000-0000000c0001', 'R8B setup account', 'r8b-setup');
INSERT INTO public.user_profiles (
  id, supabase_auth_id, school_id, role, kanvise_user_id, first_name, last_name, email
) VALUES (
  '00000000-0000-4000-8000-0000000c0010', '00000000-0000-4000-8000-0000000c0011',
  '00000000-0000-4000-8000-0000000c0001', 'admin', 'R8B-ADM-0002', 'R8B', 'Setup', 'r8b-setup@example.invalid'
);

SELECT is(
  (SELECT (public.setup_programme(
    '00000000-0000-4000-8000-0000000c0001', '00000000-0000-4000-8000-0000000c0010',
    'Fingerprint class', 'fingerprint-class', '', 0, 'NGN',
    '[{"name":"Maths","slug":"maths"}]'::jsonb,
    '00000000-0000-4000-8000-0000000c0020', 'fp-one', 'one_to_one'
  ) ->> 'replayed')),
  'false', 'first call creates the Class'
);
SELECT is(
  (SELECT creation_fingerprint FROM public.programmes WHERE creation_key = '00000000-0000-4000-8000-0000000c0020'),
  'fp-one', 'fingerprint is stored by the creating call'
);
SELECT is(
  (SELECT teaching_mode FROM public.programmes WHERE creation_key = '00000000-0000-4000-8000-0000000c0020'),
  'one_to_one', 'teaching mode is stored by the creating call'
);
SELECT is(
  (SELECT (public.setup_programme(
    '00000000-0000-4000-8000-0000000c0001', '00000000-0000-4000-8000-0000000c0010',
    'Fingerprint class', 'fingerprint-class', '', 0, 'NGN',
    '[{"name":"Maths","slug":"maths"}]'::jsonb,
    '00000000-0000-4000-8000-0000000c0020', 'fp-one', 'one_to_one'
  ) ->> 'replayed')),
  'true', 'same key and fingerprint replays'
);
SELECT throws_ok(
  $$SELECT public.setup_programme(
    '00000000-0000-4000-8000-0000000c0001', '00000000-0000-4000-8000-0000000c0010',
    'Edited class', 'edited-class', '', 0, 'NGN',
    '[{"name":"Maths","slug":"maths"}]'::jsonb,
    '00000000-0000-4000-8000-0000000c0020', 'fp-two', 'group')$$,
  '22023', 'IDEMPOTENCY_KEY_REUSED', 'same key with a different fingerprint is rejected'
);
SELECT is(
  (SELECT creation_fingerprint FROM public.programmes WHERE creation_key = '00000000-0000-4000-8000-0000000c0020'),
  'fp-one', 'a rejected replay does not overwrite the stored fingerprint'
);

SELECT * FROM finish();
ROLLBACK;
