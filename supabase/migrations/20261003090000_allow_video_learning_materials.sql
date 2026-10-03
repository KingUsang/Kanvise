-- Learning materials use the existing private notes storage path. Videos stay
-- tenant- and subject-scoped; this only expands the permitted material types.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.notes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%file_type%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notes DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.notes
  ADD CONSTRAINT notes_file_type_check
  CHECK (file_type IN ('pdf', 'docx', 'pptx', 'jpg', 'png', 'mp4', 'webm', 'mov'));
