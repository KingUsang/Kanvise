-- DEV-DB-005 (expand step): account-scoped tables repeat school_id, but their
-- foreign keys reference only the parent id, so a row in one account can point
-- at a parent in another. Add composite (school_id, <parent>_id) foreign keys
-- that make the database reject that.
--
-- Scope: the curriculum and class spine only (programmes, sub_programmes,
-- courses, live_classes and their direct children). The existing
-- single-column foreign keys stay in place; dropping them is a later
-- "contract" migration after the owner confirms this one is clean.
--
-- Tables deliberately left for later: payments and reviews (their foreign keys
-- use ON DELETE SET NULL, which needs column-list SET NULL), notes,
-- assignments, submissions, mock_*, notifications, avatar_configs.
--
-- Steps:
--   1. UNIQUE (school_id, id) on each parent so it can be referenced.
--   2. Pre-check: list every child row whose parent belongs to a different
--      account or does not exist, and abort the migration if any are found.
--   3. Add each foreign key NOT VALID, then VALIDATE it.
-- Delete behaviour matches the existing single-column foreign keys (CASCADE).
-- Rows with a NULL parent column are not checked (MATCH SIMPLE).

ALTER TABLE public.programmes
  ADD CONSTRAINT programmes_school_id_id_unique UNIQUE (school_id, id);
ALTER TABLE public.sub_programmes
  ADD CONSTRAINT sub_programmes_school_id_id_unique UNIQUE (school_id, id);
ALTER TABLE public.courses
  ADD CONSTRAINT courses_school_id_id_unique UNIQUE (school_id, id);
ALTER TABLE public.live_classes
  ADD CONSTRAINT live_classes_school_id_id_unique UNIQUE (school_id, id);

DO $$
DECLARE
  spec record;
  violating_count bigint;
  report text := '';
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('sub_programmes',          'programme_id',     'programmes'),
      ('courses',                 'programme_id',     'programmes'),
      ('courses',                 'sub_programme_id', 'sub_programmes'),
      ('tutor_course_assignments','course_id',        'courses'),
      ('live_classes',            'course_id',        'courses'),
      ('attendance_records',      'live_class_id',    'live_classes'),
      ('enrolments',              'programme_id',     'programmes'),
      ('enrolments',              'sub_programme_id', 'sub_programmes'),
      ('enrolments',              'course_id',        'courses')
    ) AS t(child_table, child_column, parent_table)
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I AS child
       WHERE child.%I IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.%I AS parent
           WHERE parent.id = child.%I AND parent.school_id = child.school_id
         )',
      spec.child_table, spec.child_column, spec.parent_table, spec.child_column
    ) INTO violating_count;

    IF violating_count > 0 THEN
      report := report || format(
        E'\n  %s.%s -> %s: %s row(s) reference a parent in another account',
        spec.child_table, spec.child_column, spec.parent_table, violating_count
      );
    END IF;
  END LOOP;

  IF report <> '' THEN
    RAISE EXCEPTION
      'Cross-account references block the composite foreign keys. Fix or remove these rows, then re-run:%', report;
  END IF;
END
$$;

ALTER TABLE public.sub_programmes
  ADD CONSTRAINT sub_programmes_school_programme_fkey
  FOREIGN KEY (school_id, programme_id)
  REFERENCES public.programmes (school_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_school_programme_fkey
  FOREIGN KEY (school_id, programme_id)
  REFERENCES public.programmes (school_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_school_sub_programme_fkey
  FOREIGN KEY (school_id, sub_programme_id)
  REFERENCES public.sub_programmes (school_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.tutor_course_assignments
  ADD CONSTRAINT tutor_course_assignments_school_course_fkey
  FOREIGN KEY (school_id, course_id)
  REFERENCES public.courses (school_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.live_classes
  ADD CONSTRAINT live_classes_school_course_fkey
  FOREIGN KEY (school_id, course_id)
  REFERENCES public.courses (school_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_school_live_class_fkey
  FOREIGN KEY (school_id, live_class_id)
  REFERENCES public.live_classes (school_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.enrolments
  ADD CONSTRAINT enrolments_school_programme_fkey
  FOREIGN KEY (school_id, programme_id)
  REFERENCES public.programmes (school_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.enrolments
  ADD CONSTRAINT enrolments_school_sub_programme_fkey
  FOREIGN KEY (school_id, sub_programme_id)
  REFERENCES public.sub_programmes (school_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.enrolments
  ADD CONSTRAINT enrolments_school_course_fkey
  FOREIGN KEY (school_id, course_id)
  REFERENCES public.courses (school_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.sub_programmes VALIDATE CONSTRAINT sub_programmes_school_programme_fkey;
ALTER TABLE public.courses VALIDATE CONSTRAINT courses_school_programme_fkey;
ALTER TABLE public.courses VALIDATE CONSTRAINT courses_school_sub_programme_fkey;
ALTER TABLE public.tutor_course_assignments VALIDATE CONSTRAINT tutor_course_assignments_school_course_fkey;
ALTER TABLE public.live_classes VALIDATE CONSTRAINT live_classes_school_course_fkey;
ALTER TABLE public.attendance_records VALIDATE CONSTRAINT attendance_records_school_live_class_fkey;
ALTER TABLE public.enrolments VALIDATE CONSTRAINT enrolments_school_programme_fkey;
ALTER TABLE public.enrolments VALIDATE CONSTRAINT enrolments_school_sub_programme_fkey;
ALTER TABLE public.enrolments VALIDATE CONSTRAINT enrolments_school_course_fkey;
