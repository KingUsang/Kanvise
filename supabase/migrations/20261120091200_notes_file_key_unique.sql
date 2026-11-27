-- Slice 6B: DEV-MAT-004. One stored object may back only one Learning Material
-- per account. The API maps a unique violation (23505) to 409, so the unique
-- index must exist. The table is locked against concurrent writes while the
-- duplicate check and the index build run, and the migration fails with the
-- offending count instead of silently skipping the index. Duplicates are
-- distinct Learning Material records and are not safe to delete automatically;
-- an operator must reconcile them (keep one note per object) and re-run.

DO $$
DECLARE
  duplicate_groups bigint;
BEGIN
  LOCK TABLE public.notes IN SHARE ROW EXCLUSIVE MODE;

  SELECT pg_catalog.count(*) INTO duplicate_groups
  FROM (
    SELECT 1 FROM public.notes
    GROUP BY school_id, file_key
    HAVING pg_catalog.count(*) > 1
  ) AS duplicates;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION 'notes has % duplicate (school_id, file_key) groups; reconcile them before applying this migration', duplicate_groups;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS notes_school_file_key_unique_idx ON public.notes (school_id, file_key);
END;
$$;
