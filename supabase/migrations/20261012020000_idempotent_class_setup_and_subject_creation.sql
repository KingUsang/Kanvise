ALTER TABLE public.programmes
  ADD COLUMN IF NOT EXISTS creation_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS programmes_school_creation_key_unique
  ON public.programmes (school_id, creation_key)
  WHERE creation_key IS NOT NULL;

DROP FUNCTION IF EXISTS public.setup_programme(uuid, uuid, text, text, text, numeric, text, jsonb);

CREATE FUNCTION public.setup_programme(
  p_school_id uuid,
  p_created_by uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_price numeric,
  p_currency text,
  p_subjects jsonb,
  p_creation_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_programme public.programmes;
  v_subject jsonb;
  v_course public.courses;
  v_tutor_id uuid;
  v_courses jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_programme
  FROM public.programmes
  WHERE school_id = p_school_id AND creation_key = p_creation_key;

  IF FOUND THEN
    SELECT coalesce(jsonb_agg(to_jsonb(course) ORDER BY course.sort_order, course.name), '[]'::jsonb)
      INTO v_courses
    FROM public.courses course
    WHERE course.school_id = p_school_id AND course.programme_id = v_programme.id;
    RETURN jsonb_build_object('programme', to_jsonb(v_programme), 'courses', v_courses, 'replayed', true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_created_by AND school_id = p_school_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'ADMIN_SCHOOL_MISMATCH';
  END IF;

  IF nullif(btrim(p_name), '') IS NULL OR nullif(btrim(p_slug), '') IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'PROGRAMME_DETAILS_REQUIRED';
  END IF;
  IF jsonb_typeof(p_subjects) <> 'array' OR jsonb_array_length(p_subjects) = 0 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'SUBJECT_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_subjects) item
    GROUP BY lower(btrim(item ->> 'name')) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING errcode = '23505', message = 'DUPLICATE_SUBJECTS';
  END IF;

  INSERT INTO public.programmes (
    school_id, name, slug, description, price, currency, thumbnail_url,
    is_published, created_by, creation_key
  ) VALUES (
    p_school_id, btrim(p_name), btrim(p_slug), nullif(btrim(p_description), ''),
    greatest(coalesce(p_price, 0), 0), coalesce(nullif(p_currency, ''), 'NGN'),
    null, false, p_created_by, p_creation_key
  ) RETURNING * INTO v_programme;

  FOR v_subject IN SELECT value FROM jsonb_array_elements(p_subjects) LOOP
    IF nullif(btrim(v_subject ->> 'name'), '') IS NULL
       OR nullif(btrim(v_subject ->> 'slug'), '') IS NULL THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'SUBJECT_DETAILS_REQUIRED';
    END IF;
    INSERT INTO public.courses (
      school_id, programme_id, sub_programme_id, name, slug, description,
      price, currency, is_published, created_by, sort_order
    ) VALUES (
      p_school_id, v_programme.id, null, btrim(v_subject ->> 'name'),
      btrim(v_subject ->> 'slug'), nullif(btrim(v_subject ->> 'description'), ''),
      0, coalesce(nullif(p_currency, ''), 'NGN'), false, p_created_by,
      greatest(coalesce((v_subject ->> 'sort_order')::integer, 0), 0)
    ) RETURNING * INTO v_course;

    FOR v_tutor_id IN
      SELECT value::uuid FROM jsonb_array_elements_text(coalesce(v_subject -> 'tutor_ids', '[]'::jsonb))
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = v_tutor_id AND school_id = p_school_id AND role IN ('admin', 'tutor')
      ) THEN
        RAISE EXCEPTION USING errcode = '42501', message = 'TUTOR_SCHOOL_MISMATCH';
      END IF;
      INSERT INTO public.tutor_course_assignments (school_id, tutor_id, course_id, assigned_by)
      VALUES (p_school_id, v_tutor_id, v_course.id, p_created_by);
    END LOOP;
    v_courses := v_courses || jsonb_build_array(to_jsonb(v_course));
  END LOOP;

  RETURN jsonb_build_object('programme', to_jsonb(v_programme), 'courses', v_courses, 'replayed', false);
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_programme FROM public.programmes
  WHERE school_id = p_school_id AND creation_key = p_creation_key;
  IF FOUND THEN
    SELECT coalesce(jsonb_agg(to_jsonb(course) ORDER BY course.sort_order, course.name), '[]'::jsonb)
      INTO v_courses FROM public.courses course
    WHERE course.school_id = p_school_id AND course.programme_id = v_programme.id;
    RETURN jsonb_build_object('programme', to_jsonb(v_programme), 'courses', v_courses, 'replayed', true);
  END IF;
  RAISE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.setup_programme(uuid, uuid, text, text, text, numeric, text, jsonb, uuid)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setup_programme(uuid, uuid, text, text, text, numeric, text, jsonb, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.add_programme_subject(
  p_school_id uuid,
  p_created_by uuid,
  p_programme_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_tutor_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_course public.courses;
  v_tutor_id uuid;
  v_sort_order integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_created_by AND school_id = p_school_id AND role = 'admin'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.programmes WHERE id = p_programme_id AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'CLASS_ACCESS_DENIED';
  END IF;
  IF nullif(btrim(p_name), '') IS NULL OR nullif(btrim(p_slug), '') IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'SUBJECT_DETAILS_REQUIRED';
  END IF;
  SELECT coalesce(max(sort_order), -1) + 1 INTO v_sort_order
  FROM public.courses WHERE school_id = p_school_id AND programme_id = p_programme_id;

  INSERT INTO public.courses (
    school_id, programme_id, name, slug, description, price, currency,
    is_published, created_by, sort_order
  ) VALUES (
    p_school_id, p_programme_id, btrim(p_name), btrim(p_slug),
    nullif(btrim(p_description), ''), 0, 'NGN', false, p_created_by, v_sort_order
  ) RETURNING * INTO v_course;

  FOREACH v_tutor_id IN ARRAY coalesce(p_tutor_ids, '{}'::uuid[]) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = v_tutor_id AND school_id = p_school_id AND role IN ('admin', 'tutor')
    ) THEN
      RAISE EXCEPTION USING errcode = '42501', message = 'TUTOR_SCHOOL_MISMATCH';
    END IF;
    INSERT INTO public.tutor_course_assignments (school_id, tutor_id, course_id, assigned_by)
    VALUES (p_school_id, v_tutor_id, v_course.id, p_created_by);
  END LOOP;
  RETURN jsonb_build_object('subject', to_jsonb(v_course), 'tutor_ids', to_jsonb(coalesce(p_tutor_ids, '{}'::uuid[])));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_programme_subject(uuid, uuid, uuid, text, text, text, uuid[])
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_programme_subject(uuid, uuid, uuid, text, text, text, uuid[])
  TO service_role;
