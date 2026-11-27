-- Round 8B group B: question image media is bound to the owning bank.
BEGIN;

SELECT plan(2);

SELECT ok(
  pg_get_functiondef('public.bind_question_block_media(uuid,uuid,jsonb,text)'::regprocedure) LIKE '%QUESTION_MEDIA_WRONG_BANK%',
  'bind_question_block_media rejects media owned by another bank'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.bind_question_block_media(uuid,uuid,jsonb,text)', 'EXECUTE'),
  'authenticated cannot execute bind_question_block_media'
);

SELECT * FROM finish();
ROLLBACK;
