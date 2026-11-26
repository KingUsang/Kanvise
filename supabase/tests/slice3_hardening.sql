-- Slice 3 database hardening: composite tenant foreign keys, SECURITY DEFINER
-- search_path, setup_programme NULL handling, avatar and self-row RLS policies,
-- and super_admin removal. Runs with `supabase test db` in CI.
BEGIN;

SELECT plan(31);

-- Fixture: two accounts, one admin in account one, a Class and Subject in each.
INSERT INTO public.schools (id, name, slug)
VALUES
  ('00000000-0000-4000-8000-000000000101', 'Slice 3 account one', 'slice3-one'),
  ('00000000-0000-4000-8000-000000000102', 'Slice 3 account two', 'slice3-two');
INSERT INTO public.user_profiles (
  id, supabase_auth_id, school_id, role, kanvise_user_id, first_name, last_name, email
)
VALUES (
  '00000000-0000-4000-8000-000000000110',
  '00000000-0000-4000-8000-000000000111',
  '00000000-0000-4000-8000-000000000101',
  'admin', 'SLICE3-ADM-0001', 'Slice', 'Admin', 'slice3-admin@example.invalid'
);
INSERT INTO public.programmes (id, school_id, name, slug, created_by)
VALUES
  ('00000000-0000-4000-8000-000000000120', '00000000-0000-4000-8000-000000000101',
   'Slice 3 class one', 'slice3-class-one', '00000000-0000-4000-8000-000000000110'),
  ('00000000-0000-4000-8000-000000000121', '00000000-0000-4000-8000-000000000102',
   'Slice 3 class two', 'slice3-class-two', '00000000-0000-4000-8000-000000000110');
INSERT INTO public.courses (id, school_id, programme_id, name, slug, created_by)
VALUES (
  '00000000-0000-4000-8000-000000000130', '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000120', 'Slice 3 subject one', 'slice3-subject-one',
  '00000000-0000-4000-8000-000000000110'
);

-- DEV-DB-005: composite foreign keys exist and reject cross-account rows.
SELECT col_is_unique('public', 'programmes', ARRAY['school_id', 'id'], 'programmes can be referenced by (school_id, id)');
SELECT col_is_unique('public', 'courses', ARRAY['school_id', 'id'], 'courses can be referenced by (school_id, id)');
SELECT col_is_unique('public', 'live_classes', ARRAY['school_id', 'id'], 'live_classes can be referenced by (school_id, id)');
SELECT col_is_unique('public', 'sub_programmes', ARRAY['school_id', 'id'], 'sub_programmes can be referenced by (school_id, id)');

SELECT ok(
  (SELECT count(*) = 9 FROM pg_constraint
   WHERE contype = 'f' AND convalidated
     AND conname IN (
       'sub_programmes_school_programme_fkey', 'courses_school_programme_fkey',
       'courses_school_sub_programme_fkey', 'tutor_course_assignments_school_course_fkey',
       'live_classes_school_course_fkey', 'attendance_records_school_live_class_fkey',
       'enrolments_school_programme_fkey', 'enrolments_school_sub_programme_fkey',
       'enrolments_school_course_fkey')),
  'all nine composite foreign keys exist and are validated'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_programme_id_fkey' AND contype = 'f'),
  'legacy single-column foreign key is kept during the expand phase'
);

SELECT throws_ok(
  $$INSERT INTO public.courses (school_id, programme_id, name, slug, created_by)
    VALUES (
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000120',
      'Cross-account subject', 'slice3-cross-subject',
      '00000000-0000-4000-8000-000000000110'
    )$$,
  '23503', NULL,
  'a Subject cannot reference a Class in another account'
);

SELECT throws_ok(
  $$INSERT INTO public.tutor_course_assignments (school_id, tutor_id, course_id, assigned_by)
    VALUES (
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000110',
      '00000000-0000-4000-8000-000000000130',
      '00000000-0000-4000-8000-000000000110'
    )$$,
  '23503', NULL,
  'a Tutor assignment cannot reference a Subject in another account'
);

SELECT throws_ok(
  $$INSERT INTO public.sub_programmes (school_id, programme_id, name, slug, created_by)
    VALUES (
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000120',
      'Cross-account group', 'slice3-cross-group',
      '00000000-0000-4000-8000-000000000110'
    )$$,
  '23503', NULL,
  'a sub-programme cannot reference a Class in another account'
);

SELECT lives_ok(
  $$INSERT INTO public.courses (school_id, programme_id, name, slug, created_by)
    VALUES (
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000120',
      'Same-account subject', 'slice3-same-subject',
      '00000000-0000-4000-8000-000000000110'
    )$$,
  'a Subject in the same account as its Class is accepted'
);

-- DEV-DB-007: every SECURITY DEFINER function in public has an empty path.
SELECT is(
  (SELECT count(*)::int
   FROM pg_proc AS proc
   JOIN pg_namespace AS ns ON ns.oid = proc.pronamespace
   WHERE ns.nspname = 'public'
     AND proc.prosecdef
     AND NOT COALESCE('search_path=""' = ANY (proc.proconfig), false)),
  0,
  'every SECURITY DEFINER function in public has search_path set to empty'
);

SELECT is(
  (SELECT proconfig FROM pg_proc
   WHERE oid = 'public.confirm_student_payment(text,text,bigint)'::regprocedure),
  ARRAY['search_path=""'],
  'confirm_student_payment has an empty search_path'
);
SELECT ok(
  (SELECT prosecdef FROM pg_proc
   WHERE oid = 'public.confirm_student_payment(text,text,bigint)'::regprocedure),
  'confirm_student_payment is still SECURITY DEFINER'
);
SELECT function_privs_are(
  'public', 'confirm_student_payment', ARRAY['text', 'text', 'bigint'],
  'service_role', ARRAY['EXECUTE'],
  'service_role can execute confirm_student_payment'
);
SELECT function_privs_are(
  'public', 'confirm_student_payment', ARRAY['text', 'text', 'bigint'],
  'authenticated', ARRAY[]::text[],
  'authenticated cannot execute confirm_student_payment'
);
SELECT function_privs_are(
  'public', 'confirm_student_payment', ARRAY['text', 'text', 'bigint'],
  'anon', ARRAY[]::text[],
  'anon cannot execute confirm_student_payment'
);
SELECT is(
  (SELECT proconfig FROM pg_proc
   WHERE oid = 'public.consume_account_invitation(text,text,uuid)'::regprocedure),
  ARRAY['search_path=""'],
  'consume_account_invitation has an empty search_path'
);
SELECT is(
  (SELECT proconfig FROM pg_proc
   WHERE oid = 'public.prepare_live_class_provider_recovery(uuid,text)'::regprocedure),
  ARRAY['search_path=""'],
  'prepare_live_class_provider_recovery has an empty search_path'
);
SELECT throws_ok(
  $$SELECT public.confirm_student_payment('slice3-missing-reference', 'txn', 100)$$,
  'P0002', 'PAYMENT_NOT_FOUND',
  'confirm_student_payment still raises PAYMENT_NOT_FOUND for an unknown reference under the empty search_path'
);

-- DEV-DB-017: setup_programme rejects NULL, non-array and empty Subject lists.
SELECT throws_ok(
  $$SELECT public.setup_programme(
      '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000110',
      'Null subjects', 'slice3-null-subjects', NULL, 0, 'NGN', NULL::jsonb, gen_random_uuid())$$,
  '22023', 'SUBJECT_REQUIRED', 'NULL Subject list is rejected'
);
SELECT throws_ok(
  $$SELECT public.setup_programme(
      '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000110',
      'Scalar subjects', 'slice3-scalar-subjects', NULL, 0, 'NGN', '"maths"'::jsonb, gen_random_uuid())$$,
  '22023', 'SUBJECT_REQUIRED', 'non-array Subject list is rejected'
);
SELECT throws_ok(
  $$SELECT public.setup_programme(
      '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000110',
      'Empty subjects', 'slice3-empty-subjects', NULL, 0, 'NGN', '[]'::jsonb, gen_random_uuid())$$,
  '22023', 'SUBJECT_REQUIRED', 'empty Subject list is rejected'
);
SELECT lives_ok(
  $$SELECT public.setup_programme(
      '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000110',
      'Valid subjects', 'slice3-valid-subjects', NULL, 0, 'NGN',
      '[{"name": "Maths", "slug": "slice3-maths"}]'::jsonb, gen_random_uuid())$$,
  'a valid Subject list is still accepted'
);

-- DEV-AVT-002: avatar policies are per-operation and own-row only.
SELECT policies_are(
  'public', 'avatar_configs',
  ARRAY['avatar_configs_select_own', 'avatar_configs_insert_own',
        'avatar_configs_update_own', 'avatar_configs_delete_own'],
  'avatar_configs has exactly the four own-row policies'
);
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'avatar_configs' AND cmd = 'ALL'),
  0,
  'avatar_configs has no FOR ALL policy'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatar_configs'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) NOT LIKE '%supabase_auth_id%'
  ),
  'every avatar policy resolves the caller through supabase_auth_id'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatar_configs'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%current_user_school_id%'
  ),
  'avatar policies do not depend on current_user_school_id(), which staging lacks'
);

-- DEV-DB-015: self-row policies map auth.uid() to the Profile.
-- Names longer than 63 bytes are stored truncated, so the enrolments and
-- payments names below are the stored (short) form. Counting matches makes
-- the check fail if a name is wrong instead of passing on no rows.
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public'
      AND (tablename, policyname) IN (
        ('user_profiles', 'Users can update their own profile'),
        ('enrolments', 'Users can view their own enrolments or admins view all school e'),
        ('payments', 'Users can view their own payments or admins view school payment'),
        ('attendance_records', 'Students view attendance, admins/tutors manage'),
        ('mock_attempts', 'Students view and create their own attempts'),
        ('notifications', 'Users view and manage their own notifications'))
      AND qual LIKE '%supabase_auth_id%'),
  6,
  'self-row policies compare the Auth ID through supabase_auth_id'
);

-- DEV-DOM-003: super_admin is gone.
SELECT throws_ok(
  $$INSERT INTO public.user_profiles (
      supabase_auth_id, school_id, role, kanvise_user_id, first_name, last_name, email)
    VALUES (gen_random_uuid(), '00000000-0000-4000-8000-000000000101',
      'super_admin', 'SLICE3-SUP-0001', 'Super', 'Admin', 'slice3-super@example.invalid')$$,
  '23514', NULL,
  'user_profiles rejects the super_admin role'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND qual LIKE '%super_admin%'
  ),
  'no RLS policy mentions super_admin'
);
SELECT is(
  (SELECT array_agg(conname::text ORDER BY conname)
   FROM pg_constraint
   WHERE conrelid = 'public.user_profiles'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%role%'
     AND pg_get_constraintdef(oid) LIKE '%student%'),
  ARRAY['user_profiles_role_supported_check'],
  'user_profiles has exactly one role CHECK'
);

SELECT * FROM finish();
ROLLBACK;
