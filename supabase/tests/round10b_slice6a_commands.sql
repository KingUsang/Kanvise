-- Round 10B: tests for the Slice 6A command functions that had none: upload intent
-- consume/release, create_school_for_admin, import_roster_students and
-- register_user_profile (DEV-UPL-002, DEV-SCH-001, DEV-AUTH-001/003, DEV-AUTH-009,
-- DEV-USR-001/002). Runs with `supabase test db` in CI.
BEGIN;

SELECT plan(41);

INSERT INTO public.schools (id, name, slug)
VALUES
  ('00000000-0000-4000-8000-000000020b01', 'Round 10B commands one', 'r10b-cmd-one'),
  ('00000000-0000-4000-8000-000000020b02', 'Round 10B commands two', 'r10b-cmd-two');
INSERT INTO public.user_profiles (id, supabase_auth_id, school_id, role, kanvise_user_id, first_name, last_name, email)
VALUES
  ('00000000-0000-4000-8000-000000020b10', '00000000-0000-4000-8000-000000020b11',
   '00000000-0000-4000-8000-000000020b01', 'admin', 'R10B-CMD-ADM-1', 'Cmd', 'Admin', 'r10b-cmd-admin@example.invalid'),
  ('00000000-0000-4000-8000-000000020b12', '00000000-0000-4000-8000-000000020b13',
   NULL, 'admin', 'R10B-CMD-ADM-2', 'New', 'Admin', 'r10b-cmd-admin-new@example.invalid'),
  ('00000000-0000-4000-8000-000000020b14', '00000000-0000-4000-8000-000000020b15',
   NULL, 'admin', 'R10B-CMD-ADM-3', 'Slug', 'Admin', 'r10b-cmd-admin-slug@example.invalid'),
  ('00000000-0000-4000-8000-000000020b16', '00000000-0000-4000-8000-000000020b17',
   '00000000-0000-4000-8000-000000020b02', 'student', 'R10B-CMD-STU-1', 'Other', 'Learner', 'r10b-cmd-other@example.invalid');
INSERT INTO public.programmes (id, school_id, name, slug, created_by)
VALUES
  ('00000000-0000-4000-8000-000000020b20', '00000000-0000-4000-8000-000000020b01',
   'Round 10B commands class', 'r10b-cmd-class', '00000000-0000-4000-8000-000000020b10'),
  ('00000000-0000-4000-8000-000000020b21', '00000000-0000-4000-8000-000000020b02',
   'Round 10B other class', 'r10b-cmd-other-class', '00000000-0000-4000-8000-000000020b16');

-- consume_upload_intent / release_upload_intent
INSERT INTO public.upload_intents (school_id, requester_id, scope, entity_type, context_id, file_key, content_type, file_size_bytes, status, expires_at)
VALUES
  ('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', 'private', 'note', 'c1', 'r10b/live', 'application/pdf', 10, 'pending', now() + interval '1 hour'),
  ('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', 'private', 'note', 'c1', 'r10b/stale', 'application/pdf', 10, 'pending', now() - interval '1 hour');

SELECT is(public.consume_upload_intent('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', 'r10b/live'), 'consumed', 'a live intent is consumed');
SELECT is(public.consume_upload_intent('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', 'r10b/live'), 'already_consumed', 'a second consume is refused');
SELECT is(public.consume_upload_intent('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b16', 'r10b/live'), 'forbidden', 'another requester is forbidden');
SELECT is(public.consume_upload_intent('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', 'r10b/unknown'), 'legacy', 'a key with no intent is legacy');
SELECT is(public.consume_upload_intent('00000000-0000-4000-8000-000000020b02', '00000000-0000-4000-8000-000000020b10', 'r10b/live'), 'legacy', 'an intent in another account is not visible');
SELECT is(public.consume_upload_intent('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', 'r10b/stale'), 'expired', 'an expired intent is refused');
SELECT public.release_upload_intent('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b16', 'r10b/live');
SELECT is((SELECT status FROM public.upload_intents WHERE file_key = 'r10b/live'), 'consumed', 'another requester cannot release the intent');
SELECT public.release_upload_intent('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', 'r10b/live');
SELECT is((SELECT status || coalesce(consumed_at::text, 'none') FROM public.upload_intents WHERE file_key = 'r10b/live'), 'pendingnone', 'the owner releases the intent back to pending');
SELECT is(public.consume_upload_intent('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', 'r10b/live'), 'consumed', 'a released intent can be consumed again');

-- create_school_for_admin
CREATE TEMP TABLE r10b_school AS
SELECT public.create_school_for_admin('00000000-0000-4000-8000-000000020b12', 'Round 10B new school', 'centre', 'r10b-new-school', 'desc', 'hello@example.invalid', NULL) AS res;
SELECT is((SELECT res ->> 'already_configured' FROM r10b_school), 'false', 'a new account is created for an admin without one');
SELECT is((SELECT res -> 'school' ->> 'name' FROM r10b_school), 'Round 10B new school', 'the created account is returned');
SELECT is((SELECT school_id::text FROM public.user_profiles WHERE id = '00000000-0000-4000-8000-000000020b12'), (SELECT res -> 'school' ->> 'id' FROM r10b_school), 'the admin is linked to the new account');
SELECT is((public.create_school_for_admin('00000000-0000-4000-8000-000000020b12', 'Round 10B again', 'centre', 'r10b-again', NULL, NULL, NULL)) ->> 'already_configured', 'true', 'a configured admin gets already_configured');
SELECT is((SELECT count(*)::int FROM public.schools WHERE slug = 'r10b-again'), 0, 'no second account is created for a configured admin');
SELECT throws_ok($$SELECT public.create_school_for_admin('00000000-0000-4000-8000-000000020b16', 'Nope', 'centre', 'r10b-nope', NULL, NULL, NULL)$$, 'P0001', 'ADMIN_NOT_FOUND', 'a non-admin profile is rejected');
SELECT throws_ok($$SELECT public.create_school_for_admin('00000000-0000-4000-8000-000000020b14', 'Dup', 'centre', 'r10b-cmd-one', NULL, NULL, NULL)$$, '23505', NULL, 'a taken slug raises a unique violation');
SELECT is((SELECT school_id FROM public.user_profiles WHERE id = '00000000-0000-4000-8000-000000020b14'), NULL, 'a failed creation leaves the admin unlinked');

-- import_roster_students
CREATE TEMP TABLE r10b_import AS
SELECT public.import_roster_students(
  '00000000-0000-4000-8000-000000020b01',
  '00000000-0000-4000-8000-000000020b10',
  '[
    {"row": 1, "email": "r10b-learner@example.invalid", "first_name": "Ada", "last_name": "One", "programme_id": "00000000-0000-4000-8000-000000020b20"},
    {"row": 2, "email": " R10B-Learner@Example.invalid ", "first_name": "Ada", "last_name": "One", "programme_id": "00000000-0000-4000-8000-000000020b20"},
    {"row": 3, "email": "", "first_name": "No", "last_name": "Email"},
    {"row": 4, "email": "r10b-wrong-class@example.invalid", "first_name": "Wrong", "last_name": "Class", "programme_id": "00000000-0000-4000-8000-000000020b21"}
  ]'::jsonb
) AS res;
SELECT is((SELECT jsonb_array_length(res) FROM r10b_import), 4, 'one result is returned per row');
SELECT is((SELECT res -> 0 ->> 'created' FROM r10b_import) || (SELECT res -> 0 ->> 'pending' FROM r10b_import), 'truetrue', 'a new Learner is created with a pending class enrolment');
SELECT is((SELECT res -> 0 ->> 'onboarding_status' FROM r10b_import), 'not_invited', 'an imported Learner starts as not invited');
SELECT is((SELECT res -> 1 ->> 'ok' FROM r10b_import) || (SELECT res -> 1 ->> 'created' FROM r10b_import), 'truefalse', 'a repeated email matches the existing profile case-insensitively');
SELECT is((SELECT res -> 2 ->> 'ok' FROM r10b_import) || (SELECT res -> 3 ->> 'ok' FROM r10b_import), 'falsefalse', 'a missing email and a class from another account fail only their own rows');
SELECT is((SELECT count(*)::int FROM public.user_profiles WHERE lower(email) = 'r10b-learner@example.invalid'), 1, 'exactly one profile exists for the repeated email');
SELECT is((SELECT count(*)::int FROM public.user_profiles WHERE lower(email) = 'r10b-wrong-class@example.invalid'), 0, 'a failed row leaves no profile behind');
SELECT is((SELECT count(*)::int FROM public.pending_student_enrolments WHERE programme_id = '00000000-0000-4000-8000-000000020b20'), 1, 'one pending enrolment exists after the repeated row');
SELECT is((SELECT count(*)::int FROM public.user_profiles WHERE lower(email) = 'r10b-learner@example.invalid' AND kanvise_user_id LIKE 'KNV-STU-%'), 1, 'the Learner gets a Kanvise ID');

-- Re-running a row converges on the same state.
SELECT public.import_roster_students('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', '[{"row": 1, "email": "r10b-learner@example.invalid", "programme_id": "00000000-0000-4000-8000-000000020b20"}]'::jsonb);
SELECT is((SELECT count(*)::int FROM public.pending_student_enrolments WHERE programme_id = '00000000-0000-4000-8000-000000020b20'), 1, 're-importing the same row adds no second pending enrolment');

-- A Learner from another account gets a membership and an enrolment here.
SELECT public.import_roster_students('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', '[{"row": 1, "email": "r10b-cmd-other@example.invalid", "programme_id": "00000000-0000-4000-8000-000000020b20"}]'::jsonb);
SELECT is((SELECT count(*)::int FROM public.student_centre_memberships WHERE student_id = '00000000-0000-4000-8000-000000020b16' AND school_id = '00000000-0000-4000-8000-000000020b01' AND status = 'active'), 1, 'a Learner from another account gets an active membership');
SELECT throws_ok($$SELECT public.import_roster_students('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', '{}'::jsonb)$$, 'P0001', 'INVALID_IMPORT_BATCH', 'a non-array batch is rejected');

-- register_user_profile
SELECT is((public.register_user_profile('admin', '00000000-0000-4000-8000-000000020b31', 'r10b-reg-admin@example.invalid', 'Reg', 'Admin')) ->> 'status', 'created', 'an admin profile is created');
SELECT is((SELECT count(*)::int FROM public.user_profiles WHERE supabase_auth_id = '00000000-0000-4000-8000-000000020b31' AND role = 'admin' AND kanvise_user_id LIKE 'KNV-ADM-%'), 1, 'the admin profile has an allocated Kanvise ID');
SELECT throws_ok($$SELECT public.register_user_profile('admin', '00000000-0000-4000-8000-000000020b31', 'r10b-reg-admin2@example.invalid', 'Reg', 'Again')$$, '23505', NULL, 'a repeated auth id raises a unique violation');
SELECT throws_ok($$SELECT public.register_user_profile('owner', '00000000-0000-4000-8000-000000020b32', 'r10b-reg-owner@example.invalid', 'Reg', 'Owner')$$, 'P0001', 'INVALID_ROLE', 'an unknown role is rejected');
SELECT throws_ok($$SELECT public.register_user_profile('tutor', '00000000-0000-4000-8000-000000020b33', 'r10b-reg-tutor@example.invalid', 'Reg', 'Tutor')$$, 'P0001', 'TUTOR_INVITATION_REQUIRED', 'a tutor cannot register without an invitation');

-- Tutor registration through a durable invitation (DEV-AUTH-003, DEV-INV-004).
INSERT INTO public.account_invitations (school_id, invited_by, role, email, token_hash, status, expires_at)
VALUES
  ('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', 'tutor', 'r10b-tutor-exp@example.invalid', 'r10b-tok-expired', 'pending', now() - interval '1 hour'),
  ('00000000-0000-4000-8000-000000020b01', '00000000-0000-4000-8000-000000020b10', 'tutor', 'r10b-tutor-ok@example.invalid', 'r10b-tok-ok', 'pending', now() + interval '1 day');

SELECT is((public.register_user_profile('tutor', '00000000-0000-4000-8000-000000020b34', 'r10b-tutor-exp@example.invalid', 'Tina', 'Expired', 'r10b-tok-expired')) ->> 'status', 'expired', 'an expired invitation is reported, not raised');
SELECT is((SELECT status FROM public.account_invitations WHERE token_hash = 'r10b-tok-expired'), 'expired', 'the expired status persists after the rejection');
SELECT is((SELECT count(*)::int FROM public.user_profiles WHERE supabase_auth_id = '00000000-0000-4000-8000-000000020b34'), 0, 'no profile is created for an expired invitation');
SELECT throws_ok($$SELECT public.register_user_profile('tutor', '00000000-0000-4000-8000-000000020b35', 'someone-else@example.invalid', 'Tom', 'Wrong', 'r10b-tok-ok')$$, 'P0001', 'INVITATION_EMAIL_MISMATCH', 'an invitation cannot be used with another email');
CREATE TEMP TABLE r10b_tutor AS
SELECT public.register_user_profile('tutor', '00000000-0000-4000-8000-000000020b36', 'r10b-tutor-ok@example.invalid', 'Tess', 'Tutor', 'r10b-tok-ok') AS res;
SELECT is((SELECT res ->> 'status' FROM r10b_tutor), 'created', 'a valid Tutor invitation creates the profile');
SELECT is((SELECT res -> 'profile' ->> 'school_id' FROM r10b_tutor), '00000000-0000-4000-8000-000000020b01', 'the Tutor joins the inviting account');
SELECT is((SELECT status FROM public.account_invitations WHERE token_hash = 'r10b-tok-ok'), 'accepted', 'the invitation is accepted in the same transaction');

SELECT * FROM finish();
ROLLBACK;
