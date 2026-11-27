-- Slice 6B: atomic assignment lifecycle guards (DEV-ASN-003, DEV-ASN-011,
-- DEV-ASN-013, DEV-ASN-016). Update, delete and submit serialize on the
-- assignment row so a submission cannot interleave with a deadline shortening or
-- a delete, and lateness is computed from the database clock. Every function is
-- service_role only and does not depend on legacy RLS helpers.

CREATE OR REPLACE FUNCTION public.update_assignment_guarded(
  p_school_id uuid,
  p_assignment_id uuid,
  p_title text,
  p_description text,
  p_deadline_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.assignments%ROWTYPE;
  updated_row public.assignments%ROWTYPE;
BEGIN
  SELECT * INTO current_row
  FROM public.assignments
  WHERE id = p_assignment_id AND school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'not_found');
  END IF;

  IF p_deadline_at IS NOT NULL THEN
    IF p_deadline_at < pg_catalog.now() + interval '1 hour' THEN
      RETURN pg_catalog.jsonb_build_object('status', 'deadline_too_soon');
    END IF;
    IF p_deadline_at < current_row.deadline_at AND EXISTS (
      SELECT 1 FROM public.submissions s WHERE s.assignment_id = p_assignment_id
    ) THEN
      RETURN pg_catalog.jsonb_build_object('status', 'has_submissions');
    END IF;
  END IF;

  UPDATE public.assignments
  SET title = COALESCE(p_title, title),
      description = COALESCE(p_description, description),
      deadline_at = COALESCE(p_deadline_at, deadline_at),
      updated_at = pg_catalog.now()
  WHERE id = p_assignment_id
  RETURNING * INTO updated_row;

  RETURN pg_catalog.jsonb_build_object('status', 'ok', 'assignment', pg_catalog.to_jsonb(updated_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_assignment_guarded(
  p_school_id uuid,
  p_assignment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.assignments%ROWTYPE;
BEGIN
  SELECT * INTO current_row
  FROM public.assignments
  WHERE id = p_assignment_id AND school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.submissions s WHERE s.assignment_id = p_assignment_id) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'has_submissions');
  END IF;

  DELETE FROM public.assignments WHERE id = p_assignment_id;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'ok',
    'attachment_file_key', current_row.attachment_file_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_assignment(
  p_school_id uuid,
  p_assignment_id uuid,
  p_student_id uuid,
  p_file_key text,
  p_file_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.assignments%ROWTYPE;
  inserted_row public.submissions%ROWTYPE;
BEGIN
  -- FOR SHARE blocks a concurrent update/delete (which takes FOR UPDATE) until
  -- this submission commits, and vice versa.
  SELECT * INTO current_row
  FROM public.assignments
  WHERE id = p_assignment_id AND school_id = p_school_id AND is_published
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.assignment_id = p_assignment_id AND s.student_id = p_student_id
  ) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'already_submitted');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.school_id = p_school_id AND s.file_key = p_file_key
  ) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'file_already_registered');
  END IF;

  BEGIN
    INSERT INTO public.submissions (school_id, assignment_id, student_id, file_key, file_name, is_late)
    VALUES (
      p_school_id, p_assignment_id, p_student_id, p_file_key, p_file_name,
      pg_catalog.now() > current_row.deadline_at
    )
    RETURNING * INTO inserted_row;
  EXCEPTION WHEN unique_violation THEN
    RETURN pg_catalog.jsonb_build_object('status', 'already_submitted');
  END;

  RETURN pg_catalog.jsonb_build_object('status', 'ok', 'submission', pg_catalog.to_jsonb(inserted_row));
END;
$$;

REVOKE ALL ON FUNCTION public.update_assignment_guarded(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_assignment_guarded(uuid, uuid, text, text, timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.delete_assignment_guarded(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_assignment_guarded(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.submit_assignment(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_assignment(uuid, uuid, uuid, text, text) TO service_role;
