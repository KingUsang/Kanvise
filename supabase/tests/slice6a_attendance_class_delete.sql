-- Slice 6A: one open attendance row per Learner and Session, and checked Class
-- deletion. Runs with `supabase test db` in CI.
BEGIN;

SELECT plan(18);

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

-- Learner, memberships and enrolments at each Class level.
INSERT INTO public.user_profiles (
  id, supabase_auth_id, school_id, role, kanvise_user_id, first_name, last_name, email, onboarding_status
)
VALUES (
  '00000000-0000-4000-8000-000000006a50',
  '00000000-0000-4000-8000-000000006a51',
  '00000000-0000-4000-8000-000000006a01',
  'student', 'SLICE6A-STU-0001', 'Slice', 'Learner', 'slice6a-learner@example.invalid', 'not_invited'
);
INSERT INTO public.account_memberships (person_id, school_id, role)
VALUES ('00000000-0000-4000-8000-000000006a50', '00000000-0000-4000-8000-000000006a01', 'learner')
ON CONFLICT (person_id, school_id) DO NOTHING;
INSERT INTO public.programmes (id, school_id, name, slug, created_by)
VALUES
  ('00000000-0000-4000-8000-000000006a22', '00000000-0000-4000-8000-000000006a01',
   'Slice 6A class three', 'slice6a-class-three', '00000000-0000-4000-8000-000000006a10'),
  ('00000000-0000-4000-8000-000000006a23', '00000000-0000-4000-8000-000000006a01',
   'Slice 6A class four', 'slice6a-class-four', '00000000-0000-4000-8000-000000006a10');
INSERT INTO public.sub_programmes (id, school_id, programme_id, name, slug, created_by)
VALUES (
  '00000000-0000-4000-8000-000000006a40', '00000000-0000-4000-8000-000000006a01',
  '00000000-0000-4000-8000-000000006a22', 'Slice 6A group', 'slice6a-group',
  '00000000-0000-4000-8000-000000006a10'
);
INSERT INTO public.courses (id, school_id, programme_id, name, slug, created_by)
VALUES (
  '00000000-0000-4000-8000-000000006a32', '00000000-0000-4000-8000-000000006a01',
  '00000000-0000-4000-8000-000000006a23', 'Slice 6A subject three', 'slice6a-subject-three',
  '00000000-0000-4000-8000-000000006a10'
);
INSERT INTO public.enrolments (school_id, student_id, programme_id, source)
VALUES ('00000000-0000-4000-8000-000000006a01', '00000000-0000-4000-8000-000000006a50',
        '00000000-0000-4000-8000-000000006a21', 'admin_import');
INSERT INTO public.enrolments (school_id, student_id, sub_programme_id, source)
VALUES ('00000000-0000-4000-8000-000000006a01', '00000000-0000-4000-8000-000000006a50',
        '00000000-0000-4000-8000-000000006a40', 'admin_import');
INSERT INTO public.enrolments (school_id, student_id, course_id, source)
VALUES ('00000000-0000-4000-8000-000000006a01', '00000000-0000-4000-8000-000000006a50',
        '00000000-0000-4000-8000-000000006a32', 'admin_import');

SELECT is(
  public.delete_programme_checked('00000000-0000-4000-8000-000000006a01', '00000000-0000-4000-8000-000000006a21'),
  'has_enrolments',
  'a Programme-level enrolment blocks the delete'
);
SELECT is(
  public.delete_programme_checked('00000000-0000-4000-8000-000000006a01', '00000000-0000-4000-8000-000000006a22'),
  'has_enrolments',
  'a Sub-programme-level enrolment blocks the delete'
);
SELECT is(
  (SELECT count(*)::int FROM public.programmes WHERE id = '00000000-0000-4000-8000-000000006a22'),
  1,
  'a blocked delete leaves the Class in place'
);
SELECT is(
  public.delete_programme_checked('00000000-0000-4000-8000-000000006a01', '00000000-0000-4000-8000-000000006a23'),
  'has_enrolments',
  'a Subject-level enrolment blocks the delete'
);

-- Duplicate open attendance rows: repair, then the unique index rejects a second one.
-- The repair statement below mirrors migration 20261120091000 so the data
-- behaviour can be checked against an existing duplicate.
INSERT INTO public.live_classes (id, school_id, course_id, tutor_id, title, scheduled_at, duration_minutes, created_by)
VALUES (
  '00000000-0000-4000-8000-000000006a60', '00000000-0000-4000-8000-000000006a01',
  '00000000-0000-4000-8000-000000006a32', '00000000-0000-4000-8000-000000006a10',
  'Slice 6A session', '2026-01-01T10:00:00Z', 60, '00000000-0000-4000-8000-000000006a10'
);
DROP INDEX public.uq_attendance_records_open_class_student;
INSERT INTO public.attendance_records (id, school_id, live_class_id, student_id, joined_at)
VALUES
  ('00000000-0000-4000-8000-000000006a73', '00000000-0000-4000-8000-000000006a01',
   '00000000-0000-4000-8000-000000006a60', '00000000-0000-4000-8000-000000006a50', '2026-01-01T10:03:00Z'),
  ('00000000-0000-4000-8000-000000006a71', '00000000-0000-4000-8000-000000006a01',
   '00000000-0000-4000-8000-000000006a60', '00000000-0000-4000-8000-000000006a50', '2026-01-01T10:01:00Z'),
  ('00000000-0000-4000-8000-000000006a72', '00000000-0000-4000-8000-000000006a01',
   '00000000-0000-4000-8000-000000006a60', '00000000-0000-4000-8000-000000006a50', '2026-01-01T10:02:00Z');
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY live_class_id, student_id ORDER BY joined_at ASC, id ASC) AS rn
  FROM public.attendance_records
  WHERE left_at IS NULL
)
UPDATE public.attendance_records ar
SET left_at = ar.joined_at, duration_seconds = 0
FROM ranked
WHERE ar.id = ranked.id AND ranked.rn > 1;
CREATE UNIQUE INDEX uq_attendance_records_open_class_student
  ON public.attendance_records (live_class_id, student_id)
  WHERE left_at IS NULL;

SELECT is(
  (SELECT count(*)::int FROM public.attendance_records
   WHERE live_class_id = '00000000-0000-4000-8000-000000006a60' AND left_at IS NULL),
  1,
  'repair leaves one open row per Learner and Session'
);
SELECT is(
  (SELECT id FROM public.attendance_records
   WHERE live_class_id = '00000000-0000-4000-8000-000000006a60' AND left_at IS NULL),
  '00000000-0000-4000-8000-000000006a71'::uuid,
  'repair keeps the earliest open row'
);
SELECT is(
  (SELECT count(*)::int FROM public.attendance_records
   WHERE live_class_id = '00000000-0000-4000-8000-000000006a60'
     AND left_at = joined_at AND duration_seconds = 0),
  2,
  'repair closes the extra rows with their own joined_at and zero duration'
);
SELECT is(
  (SELECT count(*)::int FROM public.attendance_records
   WHERE live_class_id = '00000000-0000-4000-8000-000000006a60'),
  3,
  'repair deletes no attendance rows'
);
SELECT throws_ok(
  $$INSERT INTO public.attendance_records (school_id, live_class_id, student_id, joined_at)
    VALUES ('00000000-0000-4000-8000-000000006a01', '00000000-0000-4000-8000-000000006a60',
            '00000000-0000-4000-8000-000000006a50', '2026-01-01T10:05:00Z')$$,
  '23505', NULL,
  'a second open attendance row for the same Learner and Session is rejected'
);

-- Invitation email must match the Learner profile it binds.
SELECT throws_ok(
  $$SELECT public.issue_account_invitation(
      '00000000-0000-4000-8000-000000006a01', '00000000-0000-4000-8000-000000006a10', 'student',
      'someone-else@example.invalid', 'slice6a-token-hash-mismatch',
      now() + interval '1 day', '00000000-0000-4000-8000-000000006a50')$$,
  'P0001', 'INVITATION_EMAIL_MISMATCH',
  'an invitation email that differs from the Learner profile is rejected'
);
SELECT lives_ok(
  $$SELECT public.issue_account_invitation(
      '00000000-0000-4000-8000-000000006a01', '00000000-0000-4000-8000-000000006a10', 'student',
      'Slice6A-Learner@example.invalid', 'slice6a-token-hash-match',
      now() + interval '1 day', '00000000-0000-4000-8000-000000006a50')$$,
  'an invitation email matching the Learner profile (case-insensitive) is accepted'
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
