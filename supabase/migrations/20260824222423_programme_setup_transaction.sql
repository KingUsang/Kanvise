alter table public.courses
  add column if not exists sort_order integer not null default 0;

create or replace function public.setup_programme(
  p_school_id uuid,
  p_created_by uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_price numeric,
  p_currency text,
  p_subjects jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_programme public.programmes;
  v_subject jsonb;
  v_course public.courses;
  v_tutor_id uuid;
  v_courses jsonb := '[]'::jsonb;
begin
  if not exists (
    select 1
    from public.user_profiles
    where id = p_created_by
      and school_id = p_school_id
      and role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'ADMIN_SCHOOL_MISMATCH';
  end if;

  if nullif(btrim(p_name), '') is null or nullif(btrim(p_slug), '') is null then
    raise exception using errcode = '22023', message = 'PROGRAMME_DETAILS_REQUIRED';
  end if;

  if jsonb_typeof(p_subjects) <> 'array' or jsonb_array_length(p_subjects) = 0 then
    raise exception using errcode = '22023', message = 'SUBJECT_REQUIRED';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_subjects) item
    group by lower(btrim(item ->> 'name'))
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'DUPLICATE_SUBJECTS';
  end if;

  insert into public.programmes (
    school_id, name, slug, description, price, currency, thumbnail_url,
    is_published, created_by
  ) values (
    p_school_id, btrim(p_name), btrim(p_slug), nullif(btrim(p_description), ''),
    greatest(coalesce(p_price, 0), 0), coalesce(nullif(p_currency, ''), 'NGN'),
    null, false, p_created_by
  )
  returning * into v_programme;

  for v_subject in
    select value from jsonb_array_elements(p_subjects)
  loop
    if nullif(btrim(v_subject ->> 'name'), '') is null
       or nullif(btrim(v_subject ->> 'slug'), '') is null then
      raise exception using errcode = '22023', message = 'SUBJECT_DETAILS_REQUIRED';
    end if;

    insert into public.courses (
      school_id, programme_id, sub_programme_id, name, slug, description,
      price, currency, is_published, created_by, sort_order
    ) values (
      p_school_id, v_programme.id, null, btrim(v_subject ->> 'name'),
      btrim(v_subject ->> 'slug'), nullif(btrim(v_subject ->> 'description'), ''),
      0, coalesce(nullif(p_currency, ''), 'NGN'), false, p_created_by,
      greatest(coalesce((v_subject ->> 'sort_order')::integer, 0), 0)
    )
    returning * into v_course;

    for v_tutor_id in
      select value::uuid
      from jsonb_array_elements_text(coalesce(v_subject -> 'tutor_ids', '[]'::jsonb))
    loop
      if not exists (
        select 1
        from public.user_profiles
        where id = v_tutor_id
          and school_id = p_school_id
          and role in ('admin', 'tutor')
      ) then
        raise exception using errcode = '42501', message = 'TUTOR_SCHOOL_MISMATCH';
      end if;

      insert into public.tutor_course_assignments (
        school_id, tutor_id, course_id, assigned_by
      ) values (
        p_school_id, v_tutor_id, v_course.id, p_created_by
      );
    end loop;

    v_courses := v_courses || jsonb_build_array(to_jsonb(v_course));
  end loop;

  return jsonb_build_object(
    'programme', to_jsonb(v_programme),
    'courses', v_courses
  );
end;
$$;

revoke execute on function public.setup_programme(uuid, uuid, text, text, text, numeric, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.setup_programme(uuid, uuid, text, text, text, numeric, text, jsonb)
  to service_role;
