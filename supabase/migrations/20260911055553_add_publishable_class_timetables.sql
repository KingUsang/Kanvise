-- A timetable is an editable draft until it is explicitly published. Its
-- generated live_class rows are the only records visible to existing student
-- schedule and reminder queries.
CREATE TABLE public.class_timetables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  programme_id uuid REFERENCES public.programmes(id) ON DELETE CASCADE,
  standalone_course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  has_unpublished_changes boolean NOT NULL DEFAULT false,
  published_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  timezone text NOT NULL DEFAULT 'Africa/Lagos',
  published_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_timetable_scope_check CHECK (num_nonnulls(programme_id, standalone_course_id) = 1)
);

CREATE UNIQUE INDEX class_timetables_programme_unique
  ON public.class_timetables(school_id, programme_id)
  WHERE programme_id IS NOT NULL;
CREATE UNIQUE INDEX class_timetables_standalone_unique
  ON public.class_timetables(school_id, standalone_course_id)
  WHERE standalone_course_id IS NOT NULL;

CREATE TABLE public.class_timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id uuid NOT NULL REFERENCES public.class_timetables(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 240),
  starts_on date NOT NULL,
  ends_on date,
  title text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_timetable_slot_date_check CHECK (ends_on IS NULL OR ends_on >= starts_on),
  UNIQUE(timetable_id, course_id, weekday, start_time)
);

ALTER TABLE public.live_classes
  ADD COLUMN timetable_slot_id uuid REFERENCES public.class_timetable_slots(id) ON DELETE SET NULL,
  ADD COLUMN occurrence_date date;

CREATE UNIQUE INDEX live_classes_timetable_occurrence_unique
  ON public.live_classes(timetable_slot_id, occurrence_date)
  WHERE timetable_slot_id IS NOT NULL AND occurrence_date IS NOT NULL;
CREATE INDEX class_timetable_slots_timetable_idx ON public.class_timetable_slots(timetable_id);
CREATE INDEX class_timetables_school_status_idx ON public.class_timetables(school_id, status);

ALTER TABLE public.class_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_timetable_slots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.class_timetables, public.class_timetable_slots FROM anon, authenticated;
GRANT ALL ON public.class_timetables, public.class_timetable_slots TO service_role;

CREATE OR REPLACE FUNCTION public.materialize_class_timetable(
  p_timetable_id uuid,
  p_school_id uuid,
  p_horizon_days integer DEFAULT 84
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  IF p_horizon_days < 7 OR p_horizon_days > 366 THEN
    RAISE EXCEPTION 'Timetable horizon must be between 7 and 366 days';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.class_timetables
    WHERE id = p_timetable_id AND school_id = p_school_id AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'Published timetable not found';
  END IF;

  INSERT INTO public.live_classes (
    school_id, course_id, tutor_id, title, scheduled_at, duration_minutes,
    status, created_by, timetable_slot_id, occurrence_date
  )
  SELECT
    timetable.school_id,
    slot.course_id,
    slot.tutor_id,
    COALESCE(NULLIF(btrim(slot.title), ''), course.name || ' class'),
    (calendar.day + slot.start_time) AT TIME ZONE timetable.timezone,
    slot.duration_minutes,
    'scheduled',
    timetable.created_by,
    slot.id,
    calendar.day
  FROM public.class_timetables AS timetable
  CROSS JOIN LATERAL jsonb_to_recordset(timetable.published_slots) AS slot(
    id uuid,
    course_id uuid,
    tutor_id uuid,
    weekday smallint,
    start_time time,
    duration_minutes integer,
    starts_on date,
    ends_on date,
    title text
  )
  JOIN public.courses AS course
    ON course.id = slot.course_id AND course.school_id = timetable.school_id
  CROSS JOIN LATERAL (
    SELECT generated::date AS day
    FROM generate_series(current_date, current_date + p_horizon_days, interval '1 day') AS generated
  ) AS calendar
  WHERE timetable.id = p_timetable_id
    AND timetable.school_id = p_school_id
    AND timetable.status = 'published'
    AND extract(isodow FROM calendar.day)::smallint = slot.weekday
    AND calendar.day >= slot.starts_on
    AND (slot.ends_on IS NULL OR calendar.day <= slot.ends_on)
    AND ((calendar.day + slot.start_time) AT TIME ZONE timetable.timezone) > now()
  ON CONFLICT (timetable_slot_id, occurrence_date)
    WHERE timetable_slot_id IS NOT NULL AND occurrence_date IS NOT NULL
    DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_class_timetable(
  p_timetable_id uuid,
  p_school_id uuid,
  p_published_by uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  slot_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_published_by AND school_id = p_school_id AND role = 'admin' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only an active centre admin can publish a timetable';
  END IF;

  SELECT count(*) INTO slot_count
  FROM public.class_timetable_slots
  WHERE timetable_id = p_timetable_id AND school_id = p_school_id AND deleted_at IS NULL;

  IF slot_count = 0 THEN
    RAISE EXCEPTION 'Add at least one class before publishing the timetable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_timetable_slots AS slot
    LEFT JOIN public.tutor_course_assignments AS assignment
      ON assignment.school_id = slot.school_id
      AND assignment.course_id = slot.course_id
      AND assignment.tutor_id = slot.tutor_id
    WHERE slot.timetable_id = p_timetable_id
      AND slot.school_id = p_school_id
      AND slot.deleted_at IS NULL
      AND assignment.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Every timetable class must use an assigned tutor';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_timetable_slots AS slot
    JOIN public.class_timetables AS timetable ON timetable.id = slot.timetable_id
    LEFT JOIN public.courses AS course
      ON course.id = slot.course_id AND course.school_id = slot.school_id
    WHERE slot.timetable_id = p_timetable_id
      AND slot.school_id = p_school_id
      AND slot.deleted_at IS NULL
      AND (
        course.id IS NULL
        OR (timetable.programme_id IS NOT NULL AND course.programme_id IS DISTINCT FROM timetable.programme_id)
        OR (timetable.standalone_course_id IS NOT NULL AND course.id IS DISTINCT FROM timetable.standalone_course_id)
      )
  ) THEN
    RAISE EXCEPTION 'A timetable class is outside the selected course';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_timetable_slots AS first_slot
    JOIN public.class_timetable_slots AS second_slot
      ON second_slot.timetable_id = first_slot.timetable_id
      AND second_slot.school_id = first_slot.school_id
      AND second_slot.id > first_slot.id
      AND second_slot.weekday = first_slot.weekday
      AND second_slot.tutor_id = first_slot.tutor_id
      AND second_slot.deleted_at IS NULL
      AND first_slot.start_time < second_slot.start_time + make_interval(mins => second_slot.duration_minutes)
      AND second_slot.start_time < first_slot.start_time + make_interval(mins => first_slot.duration_minutes)
    WHERE first_slot.timetable_id = p_timetable_id
      AND first_slot.school_id = p_school_id
      AND first_slot.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A tutor cannot teach overlapping timetable classes';
  END IF;

  -- Replace concrete future occurrences only when the administrator publishes.
  -- Until this transaction commits, students and reminders continue to see the
  -- previous published version.
  DELETE FROM public.live_classes
  WHERE timetable_slot_id IN (
    SELECT id FROM public.class_timetable_slots
    WHERE timetable_id = p_timetable_id AND school_id = p_school_id
  )
    AND status = 'scheduled'
    AND scheduled_at > now();

  UPDATE public.class_timetables
  SET status = 'published',
      has_unpublished_changes = false,
      published_slots = (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', slot.id,
          'course_id', slot.course_id,
          'tutor_id', slot.tutor_id,
          'weekday', slot.weekday,
          'start_time', slot.start_time,
          'duration_minutes', slot.duration_minutes,
          'starts_on', slot.starts_on,
          'ends_on', slot.ends_on,
          'title', slot.title
        ) ORDER BY slot.weekday, slot.start_time), '[]'::jsonb)
        FROM public.class_timetable_slots AS slot
        WHERE slot.timetable_id = p_timetable_id
          AND slot.school_id = p_school_id
          AND slot.deleted_at IS NULL
      ),
      published_at = now(),
      updated_at = now()
  WHERE id = p_timetable_id AND school_id = p_school_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Timetable not found'; END IF;

  slot_count := public.materialize_class_timetable(p_timetable_id, p_school_id, 84);

  DELETE FROM public.class_timetable_slots
  WHERE timetable_id = p_timetable_id
    AND school_id = p_school_id
    AND deleted_at IS NOT NULL;

  RETURN slot_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpublish_class_timetable(
  p_timetable_id uuid,
  p_school_id uuid,
  p_actor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_actor_id AND school_id = p_school_id AND role = 'admin' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only an active centre admin can edit a published timetable';
  END IF;

  UPDATE public.class_timetables
  SET has_unpublished_changes = true, updated_at = now()
  WHERE id = p_timetable_id AND school_id = p_school_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Timetable not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.materialize_published_class_timetables(p_horizon_days integer DEFAULT 84)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  timetable record;
  total_inserted integer := 0;
BEGIN
  FOR timetable IN
    SELECT id, school_id FROM public.class_timetables WHERE status = 'published'
  LOOP
    total_inserted := total_inserted + public.materialize_class_timetable(timetable.id, timetable.school_id, p_horizon_days);
  END LOOP;
  RETURN total_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_class_timetable(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_class_timetable(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unpublish_class_timetable(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.materialize_published_class_timetables(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_class_timetable(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_class_timetable(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.unpublish_class_timetable(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.materialize_published_class_timetables(integer) TO service_role;
