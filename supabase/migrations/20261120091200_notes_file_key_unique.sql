-- Slice 6B: DEV-MAT-004. One stored object may back only one Learning Material
-- per account. The unique index is created only when no duplicate rows exist,
-- so the migration cannot fail on legacy data. When duplicates exist a plain
-- index is created instead and the duplicates are reported for manual cleanup;
-- the API still maps a unique violation to 409 once the unique index is in place.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notes
    GROUP BY school_id, file_key
    HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE WARNING 'notes has duplicate (school_id, file_key) rows; unique index skipped, plain index created';
    CREATE INDEX IF NOT EXISTS notes_school_file_key_idx ON public.notes (school_id, file_key);
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS notes_school_file_key_unique_idx ON public.notes (school_id, file_key);
  END IF;
END;
$$;
