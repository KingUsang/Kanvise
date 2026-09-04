-- Align clean installs with the API contract already deployed in the original
-- development project: callers pass a role name and receive the next integer.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kanvise_id_sequences' AND column_name = 'role_prefix'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kanvise_id_sequences' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.kanvise_id_sequences RENAME COLUMN role_prefix TO role;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kanvise_id_sequences' AND column_name = 'current_val'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kanvise_id_sequences' AND column_name = 'last_value'
  ) THEN
    ALTER TABLE public.kanvise_id_sequences RENAME COLUMN current_val TO last_value;
  END IF;
END
$$;

UPDATE public.kanvise_id_sequences
SET role = CASE role
  WHEN 'ACA-ADM' THEN 'admin'
  WHEN 'ACA-TUT' THEN 'tutor'
  WHEN 'ACA-STU' THEN 'student'
  WHEN 'ACA-SUP' THEN 'support'
  ELSE role
END;

INSERT INTO public.kanvise_id_sequences(role, last_value)
VALUES ('admin', 0), ('tutor', 0), ('student', 0)
ON CONFLICT (role) DO NOTHING;

DROP FUNCTION IF EXISTS public.increment_user_sequence(TEXT);

CREATE FUNCTION public.increment_user_sequence(p_role TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  next_value INTEGER;
BEGIN
  UPDATE public.kanvise_id_sequences
  SET last_value = last_value + 1
  WHERE role = p_role
  RETURNING last_value INTO next_value;

  RETURN next_value;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_user_sequence(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_sequence(TEXT) TO service_role;
