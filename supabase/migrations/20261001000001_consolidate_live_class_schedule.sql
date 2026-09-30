-- One schedule model: one-off classes are live_classes; recurring enrolled
-- classes are a group of direct timetable slots that materialize live_classes.
-- Link-only classes intentionally remain one-off because each occurrence has
-- its own private guest link.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.class_timetable_slots
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;

CREATE INDEX IF NOT EXISTS class_timetable_slots_recurrence_group_idx
  ON public.class_timetable_slots(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL AND deleted_at IS NULL;

-- A scheduled class whose allotted time has already elapsed can no longer be
-- joined or hosted. Preserve it for history, but take it out of the active
-- schedule before enforcing overlap protection.
UPDATE public.live_classes
SET status = 'cancelled', updated_at = now()
WHERE status = 'scheduled'
  AND scheduled_at + make_interval(mins => duration_minutes) < now();

-- Do not rely only on a browser-side conflict check. This prevents two admins
-- from creating overlapping scheduled/live classes for the same tutor.
ALTER TABLE public.live_classes
  ADD CONSTRAINT live_classes_tutor_time_no_overlap
  EXCLUDE USING gist (
    tutor_id WITH =,
    tsrange(
      scheduled_at AT TIME ZONE 'UTC',
      (scheduled_at AT TIME ZONE 'UTC') + duration_minutes * interval '1 minute',
      '[)'
    ) WITH &&
  )
  WHERE (status IN ('scheduled', 'live'));

CREATE OR REPLACE FUNCTION public.create_recurring_live_class_series(
  p_school_id uuid,
  p_actor_id uuid,
  p_course_id uuid,
  p_tutor_id uuid,
  p_title text,
  p_starts_on date,
  p_start_time time,
  p_timezone text,
  p_duration_minutes integer,
  p_weekdays smallint[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  series_id uuid := gen_random_uuid();
  slot_id uuid;
  weekday smallint;
BEGIN
  SELECT role INTO actor_role
  FROM public.user_profiles
  WHERE id = p_actor_id AND school_id = p_school_id AND is_active = true;

  IF actor_role NOT IN ('admin', 'tutor') THEN
    RAISE EXCEPTION 'Only an active tutor or centre admin can schedule recurring classes';
  END IF;
  IF actor_role = 'tutor' AND p_tutor_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Tutors can only schedule their own recurring classes';
  END IF;
  IF p_duration_minutes < 15 OR p_duration_minutes > 240 THEN
    RAISE EXCEPTION 'Duration must be between 15 and 240 minutes';
  END IF;
  IF p_weekdays IS NULL OR cardinality(p_weekdays) = 0 OR EXISTS (
    SELECT 1 FROM unnest(p_weekdays) AS day WHERE day < 1 OR day > 7
  ) THEN
    RAISE EXCEPTION 'Choose at least one weekday';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
    RAISE EXCEPTION 'Choose a valid timezone';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tutor_course_assignments
    WHERE school_id = p_school_id AND course_id = p_course_id AND tutor_id = p_tutor_id
  ) THEN
    RAISE EXCEPTION 'Choose a subject assigned to this tutor';
  END IF;

  FOREACH weekday IN ARRAY p_weekdays LOOP
    INSERT INTO public.class_timetable_slots (
      timetable_id, school_id, course_id, tutor_id, weekday, start_time, timezone,
      duration_minutes, starts_on, ends_on, title, source, created_by, published_at,
      recurrence_group_id
    ) VALUES (
      NULL, p_school_id, p_course_id, p_tutor_id, weekday, p_start_time, p_timezone,
      p_duration_minutes, p_starts_on, NULL, NULLIF(btrim(p_title), ''), 'direct',
      p_actor_id, now(), series_id
    ) RETURNING id INTO slot_id;

    PERFORM public.materialize_direct_class_series(slot_id, p_school_id, 84);
  END LOOP;

  RETURN series_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_recurring_live_class(
  p_slot_id uuid,
  p_school_id uuid,
  p_actor_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  series_tutor_id uuid;
  removed_count integer;
BEGIN
  SELECT role INTO actor_role
  FROM public.user_profiles
  WHERE id = p_actor_id AND school_id = p_school_id AND is_active = true;

  SELECT tutor_id INTO series_tutor_id
  FROM public.class_timetable_slots
  WHERE school_id = p_school_id
    AND source = 'direct'
    AND deleted_at IS NULL
    AND (id = p_slot_id OR recurrence_group_id = p_slot_id)
  LIMIT 1;

  IF series_tutor_id IS NULL THEN RAISE EXCEPTION 'Recurring class not found'; END IF;
  IF actor_role <> 'admin' AND (actor_role <> 'tutor' OR series_tutor_id IS DISTINCT FROM p_actor_id) THEN
    RAISE EXCEPTION 'You cannot end this recurring class';
  END IF;

  UPDATE public.class_timetable_slots SET deleted_at = now(), updated_at = now()
  WHERE school_id = p_school_id
    AND source = 'direct'
    AND (id = p_slot_id OR recurrence_group_id = p_slot_id);

  DELETE FROM public.live_classes
  WHERE timetable_slot_id IN (
    SELECT id FROM public.class_timetable_slots
    WHERE school_id = p_school_id AND source = 'direct'
      AND (id = p_slot_id OR recurrence_group_id = p_slot_id)
  )
    AND status = 'scheduled' AND scheduled_at > now();
  GET DIAGNOSTICS removed_count = ROW_COUNT;
  RETURN removed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_recurring_live_class_series(uuid, uuid, uuid, uuid, text, date, time, text, integer, smallint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_recurring_live_class_series(uuid, uuid, uuid, uuid, text, date, time, text, integer, smallint[]) TO service_role;
