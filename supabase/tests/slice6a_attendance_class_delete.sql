-- Slice 6A: one open attendance row per Learner and Session, and checked Class
-- deletion. Runs with `supabase test db` in CI.
BEGIN;

SELECT plan(7);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_attendance_records_open_class_student'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%left_at IS NULL%'
  ),
  'partial unique index on open attendance rows exists'
);

INSERT INTO public.schools (id, name, slug)
VALUES
  ('00000000-0000-4000-8000-000000006a01', 'Slice 6A account one', 'slice6a-one'),
  ('00000000-0000-4000-8000-000000006a02', 'Slice 6A account two', 'slice6a-two');
INSERT INTO public.user_profiles (
  id, supabase_auth_id, school_id, role, kanvise_user_id, first_name, last_name, email
)
VALUES (
  '00000000-0000-4000-8000-000000006a10',
  '00000000-0000-4000-8000-000000006a11',
  '00000000-0000-4000-8000-000000006a01',
  'admin', 'SLICE6A-ADM-0001', 'Slice', 'Admin', 'slice6a-admin@example.invalid'
);
INSERT INTO public.programmes (id, school_id, name, slug, created_by)
VALUES
  ('00000000-0000-4000-8000-000000006a20', '00000000-0000-4000-8000-000000006a01',
   'Slice 6A class one', 'slice6a-class-one', '00000000-0000-4000-8000-000000006a10'),
  ('00000000-0000-4000-8000-000000006a21', '00000000-0000-4000-8000-000000006a01',
   'Slice 6A class two', 'slice6a-class-two', '00000000-0000-4000-8000-000000006a10');
INSERT INTO public.courses (id, school_id, programme_id, name, slug, created_by)
VALUES (
  '00000000-0000-4000-8000-000000006a30', '00000000-0000-4000-8000-000000006a01',
  '00000000-0000-4000-8000-000000006a20', 'Slice 6A subject one', 'slice6a-subject-one',
  '00000000-0000-4000-8000-000000006a10'
);

SELECT is(
  public.delete_programme_checked('00000000-0000-4000-8000-000000006a02', '00000000-0000-4000-8000-000000006a20'),
  'not_found',
  'another account cannot delete the Class'
);
SELECT is(
  (SELECT count(*)::int FROM public.programmes WHERE id = '00000000-0000-4000-8000-000000006a20'),
  1,
  'cross-account delete leaves the Class in place'
);
SELECT is(
  public.delete_programme_checked('00000000-0000-4000-8000-000000006a01', '00000000-0000-4000-8000-000000006a20'),
  'deleted',
  'a Class with no enrolments at any level is deleted'
);
SELECT is(
  (SELECT count(*)::int FROM public.courses WHERE id = '00000000-0000-4000-8000-000000006a30'),
  0,
  'Subjects of the deleted Class cascade'
);
SELECT is(
  public.delete_programme_checked('00000000-0000-4000-8000-000000006a01', '00000000-0000-4000-8000-000000006a20'),
  'not_found',
  'a second delete reports not_found'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.delete_programme_checked(uuid, uuid)', 'EXECUTE'),
  'authenticated cannot call delete_programme_checked'
);

SELECT * FROM finish();
ROLLBACK;
