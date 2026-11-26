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
--   1. Pre-check, before any DDL: abort with a report if a table or column
--      this migration needs is missing, if a constraint name it adds is
--      already taken by a different definition, if a parent table has
--      duplicate (school_id, id) pairs, or if any child row points at a
--      parent in a different account (or at no parent). Nothing is changed on
--      failure.
--   2. UNIQUE (school_id, id) on each parent so it can be referenced, unless
--      a primary key or UNIQUE constraint on exactly those two columns (in
--      either order) already exists.
--   3. Add each foreign key NOT VALID, then VALIDATE it. A foreign key that
--      already exists under the same name and definition is left alone.
--
-- Checked against the staging read-only schema report (DEV-DB-018): staging
-- has no UNIQUE (school_id, id) on programmes, courses or live_classes and
-- none of the nine foreign key names below. Its only composite foreign key on
-- these tables is enrolments_account_membership_fkey
-- (student_id, school_id) -> account_memberships, which this does not touch.
-- Delete behaviour matches the existing single-column foreign keys (CASCADE).
-- Rows with a NULL parent column are not checked (MATCH SIMPLE).

DO $$
DECLARE
  spec record;
  parent_name text;
  violating_count bigint;
  duplicate_report text := '';
  report text := '';
  structure_report text := '';
  existing_definition text;
BEGIN
  -- Structure: every table and column used below must exist.
  FOR spec IN
    SELECT * FROM (VALUES
      ('programmes', 'id'), ('programmes', 'school_id'),
      ('sub_programmes', 'id'), ('sub_programmes', 'school_id'), ('sub_programmes', 'programme_id'),
      ('courses', 'id'), ('courses', 'school_id'), ('courses', 'programme_id'), ('courses', 'sub_programme_id'),
      ('live_classes', 'id'), ('live_classes', 'school_id'), ('live_classes', 'course_id'),
      ('tutor_course_assignments', 'school_id'), ('tutor_course_assignments', 'course_id'),
      ('attendance_records', 'school_id'), ('attendance_records', 'live_class_id'),
      ('enrolments', 'school_id'), ('enrolments', 'programme_id'),
      ('enrolments', 'sub_programme_id'), ('enrolments', 'course_id')
    ) AS t(table_name, column_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns AS col
      WHERE col.table_schema = 'public'
        AND col.table_name = spec.table_name
        AND col.column_name = spec.column_name
    ) THEN
      structure_report := structure_report || format(E'\n  column public.%s.%s does not exist', spec.table_name, spec.column_name);
    END IF;
  END LOOP;

  -- Names: a constraint name this migration adds may already exist only with
  -- the same definition (then it is reused).
  FOR spec IN
    SELECT * FROM (VALUES
      ('programmes', 'programmes_school_id_id_unique', 'UNIQUE (school_id, id)'),
      ('sub_programmes', 'sub_programmes_school_id_id_unique', 'UNIQUE (school_id, id)'),
      ('courses', 'courses_school_id_id_unique', 'UNIQUE (school_id, id)'),
      ('live_classes', 'live_classes_school_id_id_unique', 'UNIQUE (school_id, id)'),
      ('sub_programmes', 'sub_programmes_school_programme_fkey', 'FOREIGN KEY (school_id, programme_id) REFERENCES programmes(school_id, id) ON DELETE CASCADE'),
      ('courses', 'courses_school_programme_fkey', 'FOREIGN KEY (school_id, programme_id) REFERENCES programmes(school_id, id) ON DELETE CASCADE'),
      ('courses', 'courses_school_sub_programme_fkey', 'FOREIGN KEY (school_id, sub_programme_id) REFERENCES sub_programmes(school_id, id) ON DELETE CASCADE'),
      ('tutor_course_assignments', 'tutor_course_assignments_school_course_fkey', 'FOREIGN KEY (school_id, course_id) REFERENCES courses(school_id, id) ON DELETE CASCADE'),
      ('live_classes', 'live_classes_school_course_fkey', 'FOREIGN KEY (school_id, course_id) REFERENCES courses(school_id, id) ON DELETE CASCADE'),
      ('attendance_records', 'attendance_records_school_live_class_fkey', 'FOREIGN KEY (school_id, live_class_id) REFERENCES live_classes(school_id, id) ON DELETE CASCADE'),
      ('enrolments', 'enrolments_school_programme_fkey', 'FOREIGN KEY (school_id, programme_id) REFERENCES programmes(school_id, id) ON DELETE CASCADE'),
      ('enrolments', 'enrolments_school_sub_programme_fkey', 'FOREIGN KEY (school_id, sub_programme_id) REFERENCES sub_programmes(school_id, id) ON DELETE CASCADE'),
      ('enrolments', 'enrolments_school_course_fkey', 'FOREIGN KEY (school_id, course_id) REFERENCES courses(school_id, id) ON DELETE CASCADE')
    ) AS t(table_name, constraint_name, definition)
  LOOP
    SELECT pg_catalog.pg_get_constraintdef(con.oid) INTO existing_definition
    FROM pg_catalog.pg_constraint AS con
    JOIN pg_catalog.pg_namespace AS ns ON ns.oid = con.connamespace
    WHERE ns.nspname = 'public' AND con.conname = spec.constraint_name;

    -- pg_get_constraintdef adds "public." when public is not on the
    -- search_path and " NOT VALID" for an unvalidated key; ignore both.
    IF FOUND AND replace(regexp_replace(existing_definition, ' NOT VALID$', ''), 'REFERENCES public.', 'REFERENCES ')
       IS DISTINCT FROM spec.definition THEN
      structure_report := structure_report || format(
        E'\n  constraint %s already exists as %s, expected %s on public.%s',
        spec.constraint_name, existing_definition, spec.definition, spec.table_name
      );
    END IF;
  END LOOP;

  IF structure_report <> '' THEN
    RAISE EXCEPTION
      E'Slice 3 pre-check failed (20261120090500): the schema does not match what the composite foreign keys need:%\nCompare with the real schema and update this migration before it is applied. Nothing was changed.',
      structure_report;
  END IF;

  -- id is the primary key on every parent, so duplicates should be impossible.
  -- Check anyway so a surprise shows up as a clear message, not a bare
  -- unique-violation from ADD CONSTRAINT.
  FOREACH parent_name IN ARRAY ARRAY['programmes', 'sub_programmes', 'courses', 'live_classes']
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM (
         SELECT 1 FROM public.%I GROUP BY school_id, id HAVING count(*) > 1
       ) AS duplicates',
      parent_name
    ) INTO violating_count;

    IF violating_count > 0 THEN
      duplicate_report := duplicate_report || format(
        E'\n  public.%s: %s duplicate (school_id, id) pair(s)',
        parent_name, violating_count
      );
    END IF;
  END LOOP;

  IF duplicate_report <> '' THEN
    RAISE EXCEPTION
      E'Slice 3 pre-check failed (20261120090500): UNIQUE (school_id, id) cannot be added:%\nRemove the duplicate rows, then re-run. Nothing was changed.',
      duplicate_report;
  END IF;

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
        E'\n  public.%s.%s -> public.%s: %s row(s) reference a parent in another account or no parent',
        spec.child_table, spec.child_column, spec.parent_table, violating_count
      );
    END IF;
  END LOOP;

  IF report <> '' THEN
    RAISE EXCEPTION
      E'Slice 3 pre-check failed (20261120090500): cross-account references block the composite foreign keys:%\nFind the rows with a query of the form: select child.id from public.<child> child join public.<parent> parent on parent.id = child.<column> where parent.school_id <> child.school_id. Fix or remove them, then re-run. Nothing was changed.',
      report;
  END IF;
END
$$;

DO $$
DECLARE
  parent_name text;
  fk record;
BEGIN
  FOREACH parent_name IN ARRAY ARRAY['programmes', 'sub_programmes', 'courses', 'live_classes']
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint AS con
      WHERE con.conrelid = format('public.%I', parent_name)::regclass
        AND con.contype IN ('p', 'u')
        AND cardinality(con.conkey) = 2
        AND (
          SELECT array_agg(att.attname::text ORDER BY att.attname)
          FROM pg_catalog.pg_attribute AS att
          WHERE att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
        ) = ARRAY['id', 'school_id']
    ) THEN
      RAISE NOTICE 'Slice 3 (20261120090500): public.% already has a unique key on (school_id, id), reused', parent_name;
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (school_id, id)',
        parent_name, parent_name || '_school_id_id_unique'
      );
    END IF;
  END LOOP;

  FOR fk IN
    SELECT * FROM (VALUES
      (1, 'sub_programmes',           'sub_programmes_school_programme_fkey',        'programme_id',     'programmes'),
      (2, 'courses',                  'courses_school_programme_fkey',               'programme_id',     'programmes'),
      (3, 'courses',                  'courses_school_sub_programme_fkey',           'sub_programme_id', 'sub_programmes'),
      (4, 'tutor_course_assignments', 'tutor_course_assignments_school_course_fkey', 'course_id',        'courses'),
      (5, 'live_classes',             'live_classes_school_course_fkey',             'course_id',        'courses'),
      (6, 'attendance_records',       'attendance_records_school_live_class_fkey',   'live_class_id',    'live_classes'),
      (7, 'enrolments',               'enrolments_school_programme_fkey',            'programme_id',     'programmes'),
      (8, 'enrolments',               'enrolments_school_sub_programme_fkey',        'sub_programme_id', 'sub_programmes'),
      (9, 'enrolments',               'enrolments_school_course_fkey',               'course_id',        'courses')
    ) AS t(sort_order, child_table, constraint_name, child_column, parent_table)
    ORDER BY sort_order
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint AS con
      WHERE con.conrelid = format('public.%I', fk.child_table)::regclass
        AND con.conname = fk.constraint_name
    ) THEN
      RAISE NOTICE 'Slice 3 (20261120090500): % already exists with the expected definition, reused', fk.constraint_name;
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (school_id, %I) REFERENCES public.%I (school_id, id) ON DELETE CASCADE NOT VALID',
        fk.child_table, fk.constraint_name, fk.child_column, fk.parent_table
      );
    END IF;

    EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', fk.child_table, fk.constraint_name);
  END LOOP;
END
$$;
