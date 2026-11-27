-- Round 8B group B: question image media is bound to the owning bank.
BEGIN;

SELECT plan(6);

-- Fixture: one account, two banks, one question version in bank A, ready media in each bank.
INSERT INTO public.schools (id, name, slug)
VALUES ('00000000-0000-4000-8000-0000000b0001', 'R8B media account', 'r8b-media');
INSERT INTO public.user_profiles (
  id, supabase_auth_id, school_id, role, kanvise_user_id, first_name, last_name, email
) VALUES (
  '00000000-0000-4000-8000-0000000b0010', '00000000-0000-4000-8000-0000000b0011',
  '00000000-0000-4000-8000-0000000b0001', 'admin', 'R8B-ADM-0001', 'R8B', 'Admin', 'r8b-admin@example.invalid'
);
INSERT INTO public.question_banks (id, school_id, owner_id, name) VALUES
  ('00000000-0000-4000-8000-0000000b0020', '00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000b0010', 'Bank A'),
  ('00000000-0000-4000-8000-0000000b0021', '00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000b0010', 'Bank B');
INSERT INTO public.bank_questions (id, school_id, bank_id, author_id, question_type)
VALUES ('00000000-0000-4000-8000-0000000b0030', '00000000-0000-4000-8000-0000000b0001',
  '00000000-0000-4000-8000-0000000b0020', '00000000-0000-4000-8000-0000000b0010', 'theory');
INSERT INTO public.bank_question_versions (id, school_id, question_id, version_number, created_by)
VALUES ('00000000-0000-4000-8000-0000000b0040', '00000000-0000-4000-8000-0000000b0001',
  '00000000-0000-4000-8000-0000000b0030', 1, '00000000-0000-4000-8000-0000000b0010');
INSERT INTO public.question_media (
  id, school_id, owner_id, storage_key, original_filename, mime_type, byte_size, checksum, processing_status
) VALUES
  ('00000000-0000-4000-8000-0000000b0050', '00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000b0010',
   'schools/00000000-0000-4000-8000-0000000b0001/private/question_media/00000000-0000-4000-8000-0000000b0020/a.png',
   'a.png', 'image/png', 10, 'a', 'ready'),
  ('00000000-0000-4000-8000-0000000b0051', '00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000b0010',
   'schools/00000000-0000-4000-8000-0000000b0001/private/question_media/00000000-0000-4000-8000-0000000b0021/b.png',
   'b.png', 'image/png', 10, 'b', 'ready');

SELECT ok(
  pg_get_functiondef('public.bind_question_block_media(uuid,uuid,jsonb,text)'::regprocedure) LIKE '%QUESTION_MEDIA_WRONG_BANK%',
  'bind_question_block_media rejects media owned by another bank'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.bind_question_block_media(uuid,uuid,jsonb,text)', 'EXECUTE'),
  'authenticated cannot execute bind_question_block_media'
);

SELECT lives_ok(
  $$SELECT public.bind_question_block_media(
    '00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000b0040',
    '[{"type":"image","media_id":"00000000-0000-4000-8000-0000000b0050"}]'::jsonb, 'content')$$,
  'media under the owning bank prefix binds'
);
SELECT is(
  (SELECT count(*)::int FROM public.bank_question_version_media
   WHERE question_version_id = '00000000-0000-4000-8000-0000000b0040'),
  1, 'the same-bank binding row exists'
);
SELECT throws_ok(
  $$SELECT public.bind_question_block_media(
    '00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000b0040',
    '[{"type":"image","media_id":"00000000-0000-4000-8000-0000000b0051"}]'::jsonb, 'explanation')$$,
  'P0001', 'QUESTION_MEDIA_WRONG_BANK', 'media owned by another bank is rejected'
);
SELECT throws_ok(
  $$SELECT public.bind_question_block_media(
    '00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000b0099',
    '[{"type":"image","media_id":"00000000-0000-4000-8000-0000000b0050"}]'::jsonb, 'content')$$,
  'P0001', 'QUESTION_MEDIA_WRONG_BANK', 'an unknown question version fails closed'
);

SELECT * FROM finish();
ROLLBACK;
