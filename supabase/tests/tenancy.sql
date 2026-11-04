BEGIN;

SELECT plan(6);

SELECT has_table('public', 'account_memberships', 'general account membership table exists');
SELECT has_index('public', 'account_memberships', 'account_memberships_person_status_idx', 'membership lookup index exists');
SELECT col_is_unique('public', 'account_memberships', ARRAY['person_id', 'school_id'], 'one membership per person and account');
SELECT has_check('public', 'account_memberships', 'account_memberships_revocation_consistency', 'membership status and revocation timestamp agree');
SELECT function_privs_are(
  'public',
  'sync_account_membership_from_legacy_student',
  ARRAY[]::text[],
  'service_role',
  ARRAY['EXECUTE'],
  'legacy sync trigger is server-only'
);

INSERT INTO public.schools (id, name, slug)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Tenancy test account one', 'tenancy-test-one'),
  ('00000000-0000-4000-8000-000000000002', 'Tenancy test account two', 'tenancy-test-two');
INSERT INTO public.user_profiles (
  id, supabase_auth_id, school_id, role, kanvise_user_id, first_name, last_name, email
)
VALUES (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000001',
  'student', 'TENANCY-STU-0001', 'Tenancy', 'Learner', 'tenancy-test@example.invalid'
);
INSERT INTO public.account_memberships (person_id, school_id, role)
VALUES (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000001',
  'learner'
);
INSERT INTO public.programmes (id, school_id, name, slug, created_by)
VALUES (
  '00000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000002',
  'Tenancy test programme', 'tenancy-test-programme',
  '00000000-0000-4000-8000-000000000010'
);
INSERT INTO public.courses (id, school_id, programme_id, name, slug, created_by)
VALUES (
  '00000000-0000-4000-8000-000000000021',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000020',
  'Tenancy test course', 'tenancy-test-course',
  '00000000-0000-4000-8000-000000000010'
);

SELECT throws_ok(
  $$INSERT INTO public.student_programme_subjects (school_id, student_id, programme_id, course_id)
    VALUES (
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000020',
      '00000000-0000-4000-8000-000000000021'
    )$$,
  '23503',
  'cross-account student relationship is rejected by PostgreSQL'
);

SELECT * FROM finish();
ROLLBACK;
