-- Message channels: held messages, notification preferences and unsubscribe
-- tokens (18 NTF-03, NTF-04; 20 DM-15). Runs with `supabase test db` in CI.
BEGIN;

SELECT plan(31);

INSERT INTO public.schools (id, name, slug)
VALUES
  ('00000000-0000-4000-8000-0000000c4a01', 'Message channels one', 'msg-channels-one'),
  ('00000000-0000-4000-8000-0000000c4a02', 'Message channels two', 'msg-channels-two');
INSERT INTO public.user_profiles (id, supabase_auth_id, school_id, role, kanvise_user_id, first_name, last_name, email)
VALUES
  ('00000000-0000-4000-8000-0000000c4a10', '00000000-0000-4000-8000-0000000c4a11',
   '00000000-0000-4000-8000-0000000c4a01', 'tutor', 'MSG-CH-TUTOR-1', 'Michael', 'Chen', 'msg-channels-tutor@example.invalid'),
  ('00000000-0000-4000-8000-0000000c4a20', '00000000-0000-4000-8000-0000000c4a21',
   '00000000-0000-4000-8000-0000000c4a01', 'tutor', 'MSG-CH-TUTOR-2', 'Priya', 'Shah', 'msg-channels-other@example.invalid');
INSERT INTO public.account_memberships (person_id, school_id, role)
VALUES
  ('00000000-0000-4000-8000-0000000c4a10', '00000000-0000-4000-8000-0000000c4a01', 'tutor'),
  ('00000000-0000-4000-8000-0000000c4a20', '00000000-0000-4000-8000-0000000c4a01', 'tutor')
ON CONFLICT (person_id, school_id) DO NOTHING;

-- RLS on, and nothing for browser roles.
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.held_messages'::regclass), 'held_messages has RLS on');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notification_preferences'::regclass), 'notification_preferences has RLS on');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.unsubscribe_tokens'::regclass), 'unsubscribe_tokens has RLS on');
SELECT ok(NOT has_table_privilege('authenticated', 'public.held_messages', 'SELECT,INSERT,UPDATE,DELETE'), 'authenticated has no access to held_messages');
SELECT ok(NOT has_table_privilege('authenticated', 'public.notification_preferences', 'SELECT,INSERT,UPDATE,DELETE'), 'authenticated has no access to notification_preferences');
SELECT ok(NOT has_table_privilege('authenticated', 'public.unsubscribe_tokens', 'SELECT,INSERT,UPDATE,DELETE'), 'authenticated has no access to unsubscribe_tokens');
SELECT ok(NOT has_table_privilege('anon', 'public.unsubscribe_tokens', 'SELECT,INSERT,UPDATE,DELETE'), 'anon has no access to unsubscribe_tokens');
SELECT ok(NOT has_function_privilege('authenticated', 'public.claim_due_held_messages(integer)', 'EXECUTE'), 'authenticated cannot claim held messages');
SELECT ok(NOT has_function_privilege('anon', 'public.apply_unsubscribe_token(text, boolean)', 'EXECUTE'), 'anon cannot apply unsubscribe tokens directly');
SELECT ok(has_function_privilege('service_role', 'public.cancel_held_message(uuid, uuid, uuid)', 'EXECUTE'), 'service_role can cancel held messages');

-- The actor must belong to the account.
SELECT throws_ok($$
  INSERT INTO public.held_messages (school_id, actor_id, subject_key, event, release_at)
  VALUES ('00000000-0000-4000-8000-0000000c4a02', '00000000-0000-4000-8000-0000000c4a10', 'lesson:x', 'lesson_moved', now())
$$, '23503', NULL, 'a held message needs the actor''s membership in that account');

-- Fixtures. now() is fixed for the whole transaction, so times are relative to it.
INSERT INTO public.held_messages (id, school_id, actor_id, subject_key, event, release_at, created_at)
VALUES
  -- Subject 1: move, then cancel. Both windows closed.
  ('00000000-0000-4000-8000-0000000c4b01', '00000000-0000-4000-8000-0000000c4a01', '00000000-0000-4000-8000-0000000c4a10',
   'lesson:1', 'lesson_moved', now() - interval '2 minutes', now() - interval '7 minutes'),
  ('00000000-0000-4000-8000-0000000c4b02', '00000000-0000-4000-8000-0000000c4a01', '00000000-0000-4000-8000-0000000c4a10',
   'lesson:1', 'lesson_cancelled', now() - interval '1 minute', now() - interval '6 minutes'),
  -- Subject 2: move, then cancel that is undone.
  ('00000000-0000-4000-8000-0000000c4b03', '00000000-0000-4000-8000-0000000c4a01', '00000000-0000-4000-8000-0000000c4a10',
   'lesson:2', 'lesson_moved', now() - interval '2 minutes', now() - interval '7 minutes'),
  ('00000000-0000-4000-8000-0000000c4b04', '00000000-0000-4000-8000-0000000c4a01', '00000000-0000-4000-8000-0000000c4a10',
   'lesson:2', 'lesson_cancelled', now() + interval '3 minutes', now() - interval '2 minutes'),
  -- Subject 3: older window closed, newer still open.
  ('00000000-0000-4000-8000-0000000c4b05', '00000000-0000-4000-8000-0000000c4a01', '00000000-0000-4000-8000-0000000c4a10',
   'lesson:3', 'lesson_moved', now() - interval '1 minute', now() - interval '6 minutes'),
  ('00000000-0000-4000-8000-0000000c4b06', '00000000-0000-4000-8000-0000000c4a01', '00000000-0000-4000-8000-0000000c4a10',
   'lesson:3', 'lesson_moved', now() + interval '4 minutes', now() - interval '1 minute');

-- Undo is only for the person who acted, in the same account.
SELECT ok(NOT public.cancel_held_message('00000000-0000-4000-8000-0000000c4b04', '00000000-0000-4000-8000-0000000c4a20', '00000000-0000-4000-8000-0000000c4a01'), 'another person cannot undo the message');
SELECT ok(NOT public.cancel_held_message('00000000-0000-4000-8000-0000000c4b04', '00000000-0000-4000-8000-0000000c4a10', '00000000-0000-4000-8000-0000000c4a02'), 'undo from another account does nothing');
SELECT ok(NOT public.release_held_message_now('00000000-0000-4000-8000-0000000c4b04', '00000000-0000-4000-8000-0000000c4a20', '00000000-0000-4000-8000-0000000c4a01'), 'another person cannot release the message early');
SELECT ok(public.cancel_held_message('00000000-0000-4000-8000-0000000c4b04', '00000000-0000-4000-8000-0000000c4a10', '00000000-0000-4000-8000-0000000c4a01'), 'the person who acted can undo');
SELECT ok(NOT public.cancel_held_message('00000000-0000-4000-8000-0000000c4b04', '00000000-0000-4000-8000-0000000c4a10', '00000000-0000-4000-8000-0000000c4a01'), 'undo twice changes nothing');

CREATE TEMP TABLE claimed ON COMMIT DROP AS SELECT * FROM public.claim_due_held_messages(50);

SELECT is((SELECT array_agg(id ORDER BY id) FROM claimed),
  ARRAY['00000000-0000-4000-8000-0000000c4b02', '00000000-0000-4000-8000-0000000c4b03']::uuid[],
  'only the newest message per subject is released');
SELECT is((SELECT status FROM public.held_messages WHERE id = '00000000-0000-4000-8000-0000000c4b01'), 'superseded', 'move then cancel: the move is superseded');
SELECT is((SELECT status FROM public.held_messages WHERE id = '00000000-0000-4000-8000-0000000c4b02'), 'released', 'move then cancel: the cancel is released');
SELECT is((SELECT status FROM public.held_messages WHERE id = '00000000-0000-4000-8000-0000000c4b03'), 'released', 'move then undone cancel: the move is released');
SELECT is((SELECT status FROM public.held_messages WHERE id = '00000000-0000-4000-8000-0000000c4b05'), 'held', 'an older message waits while a newer one is held');
SELECT is((SELECT attempts FROM public.held_messages WHERE id = '00000000-0000-4000-8000-0000000c4b02'), 1, 'claim counts the attempt');
SELECT is((SELECT count(*)::int FROM public.claim_due_held_messages(50)), 0, 'released and superseded messages are not claimed again');

-- Releasing the newer one early makes it go, and the older is superseded.
SELECT ok(public.release_held_message_now('00000000-0000-4000-8000-0000000c4b06', '00000000-0000-4000-8000-0000000c4a10', '00000000-0000-4000-8000-0000000c4a01'), 'the person who acted can release early');
SELECT is((SELECT array_agg(id) FROM public.claim_due_held_messages(50)), ARRAY['00000000-0000-4000-8000-0000000c4b06']::uuid[], 'an early release goes on the next claim');
SELECT is((SELECT status FROM public.held_messages WHERE id = '00000000-0000-4000-8000-0000000c4b05'), 'superseded', 'superseded messages are never released');

-- Unsubscribe tokens.
INSERT INTO public.unsubscribe_tokens (person_id, school_id, row_key, token_hash, expires_at)
VALUES
  ('00000000-0000-4000-8000-0000000c4a10', '00000000-0000-4000-8000-0000000c4a01', 'lesson_reminders',
   repeat('a', 64), now() + interval '90 days'),
  ('00000000-0000-4000-8000-0000000c4a10', '00000000-0000-4000-8000-0000000c4a01', 'lesson_reminders',
   repeat('b', 64), now() + interval '1 second');
UPDATE public.unsubscribe_tokens SET created_at = now() - interval '91 days', expires_at = now() - interval '1 day'
WHERE token_hash = repeat('b', 64);

SELECT throws_ok($$
  INSERT INTO public.unsubscribe_tokens (person_id, school_id, row_key, token_hash, expires_at)
  VALUES ('00000000-0000-4000-8000-0000000c4a20', '00000000-0000-4000-8000-0000000c4a01', 'lesson_reminders', repeat('a', 64), now() + interval '1 day')
$$, '23505', NULL, 'token_hash is unique');
SELECT is((SELECT count(*)::int FROM public.apply_unsubscribe_token(repeat('c', 64), false)), 0, 'an unknown token does nothing');
SELECT is((SELECT count(*)::int FROM public.apply_unsubscribe_token(repeat('b', 64), false)), 0, 'an expired token does nothing');
SELECT is((SELECT applied_row_key FROM public.apply_unsubscribe_token(repeat('a', 64), false)), 'lesson_reminders', 'a valid token switches its row');
SELECT is((SELECT email_on FROM public.notification_preferences
  WHERE person_id = '00000000-0000-4000-8000-0000000c4a10' AND school_id = '00000000-0000-4000-8000-0000000c4a01' AND row_key = 'lesson_reminders'),
  false, 'the row''s email is off and push is left alone');

SELECT * FROM finish();
ROLLBACK;
