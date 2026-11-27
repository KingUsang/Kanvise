-- DEV-ATT-003: concurrent PlugNMeet participant_joined deliveries could each
-- pass the "no open row" check and insert, leaving two open attendance_records
-- rows (left_at IS NULL) for the same Learner and Session.
--
-- Existing duplicates are repaired, not rejected: the earliest open row (by
-- joined_at, then id) is kept open and every extra is closed with its own
-- timestamps (left_at = joined_at, duration_seconds = 0), so no row is deleted
-- and no clock value is invented. Then a partial unique index prevents recurrence.

DO $$
DECLARE
  v_closed integer;
BEGIN
  WITH ranked AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY live_class_id, student_id
             ORDER BY joined_at ASC, id ASC
           ) AS rn
    FROM public.attendance_records
    WHERE left_at IS NULL
  ),
  closed AS (
    UPDATE public.attendance_records ar
    SET left_at = ar.joined_at,
        duration_seconds = 0
    FROM ranked
    WHERE ar.id = ranked.id
      AND ranked.rn > 1
    RETURNING ar.id
  )
  SELECT count(*) INTO v_closed FROM closed;

  RAISE NOTICE 'attendance_records: closed % duplicate open row(s) before adding the unique index', v_closed;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_records_open_class_student
  ON public.attendance_records (live_class_id, student_id)
  WHERE left_at IS NULL;

-- DEV-CLS-009 / DEV-CLS-018: Class (programme) deletion checked only direct
-- Programme enrolments, then hard-deleted in a separate statement, cascading
-- away Sub-programme and Subject enrolments. This function locks the Class tree
-- (which blocks concurrent enrolment inserts through the FK key-share lock),
-- checks enrolments at every level and deletes in one transaction.
CREATE OR REPLACE FUNCTION public.delete_programme_checked(
  p_school_id uuid,
  p_programme_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_found uuid;
BEGIN
  SELECT id INTO v_found
  FROM public.programmes
  WHERE id = p_programme_id AND school_id = p_school_id
  FOR UPDATE;
  IF v_found IS NULL THEN
    RETURN 'not_found';
  END IF;

  PERFORM 1 FROM public.sub_programmes
  WHERE programme_id = p_programme_id AND school_id = p_school_id
  FOR UPDATE;

  PERFORM 1 FROM public.courses c
  WHERE c.school_id = p_school_id
    AND (c.programme_id = p_programme_id
      OR c.sub_programme_id IN (
        SELECT sp.id FROM public.sub_programmes sp
        WHERE sp.programme_id = p_programme_id AND sp.school_id = p_school_id))
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.enrolments e
    WHERE e.school_id = p_school_id
      AND (e.programme_id = p_programme_id
        OR e.sub_programme_id IN (
          SELECT sp.id FROM public.sub_programmes sp
          WHERE sp.programme_id = p_programme_id AND sp.school_id = p_school_id)
        OR e.course_id IN (
          SELECT c.id FROM public.courses c
          WHERE c.school_id = p_school_id
            AND (c.programme_id = p_programme_id
              OR c.sub_programme_id IN (
                SELECT sp.id FROM public.sub_programmes sp
                WHERE sp.programme_id = p_programme_id AND sp.school_id = p_school_id))))
  ) THEN
    RETURN 'has_enrolments';
  END IF;

  DELETE FROM public.programmes WHERE id = p_programme_id AND school_id = p_school_id;
  RETURN 'deleted';
END;
$$;

REVOKE ALL ON FUNCTION public.delete_programme_checked(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_programme_checked(uuid, uuid) TO service_role;
