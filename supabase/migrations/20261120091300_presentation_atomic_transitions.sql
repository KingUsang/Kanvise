-- Slice 6B: DEV-SLD-001, DEV-SLD-002. Presentation activation, reorder and
-- annotation writes serialize on the Session row (activation, reorder) or the
-- presentation row (annotations) so partial state and lost updates cannot occur.
-- Functions are service_role only and do not depend on legacy RLS helpers.

ALTER TABLE public.live_class_presentations
  ADD COLUMN IF NOT EXISTS annotations_revision integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.activate_presentation(
  p_school_id uuid,
  p_live_class_id uuid,
  p_presentation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  activated public.live_class_presentations%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.live_classes
  WHERE id = p_live_class_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'not_found');
  END IF;

  PERFORM 1 FROM public.live_class_presentations
  WHERE id = p_presentation_id AND live_class_id = p_live_class_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'not_found');
  END IF;

  UPDATE public.live_class_presentations
  SET is_active = false
  WHERE live_class_id = p_live_class_id AND is_active AND id <> p_presentation_id;

  UPDATE public.live_class_presentations
  SET is_active = true
  WHERE id = p_presentation_id
  RETURNING * INTO activated;

  UPDATE public.live_classes
  SET teaching_mode = 'presentation'
  WHERE id = p_live_class_id;

  RETURN pg_catalog.jsonb_build_object('status', 'ok', 'presentation', pg_catalog.to_jsonb(activated));
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_presentations(
  p_school_id uuid,
  p_live_class_id uuid,
  p_ordered_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_count integer;
  matched_count integer;
BEGIN
  PERFORM 1 FROM public.live_classes
  WHERE id = p_live_class_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'not_found');
  END IF;

  SELECT pg_catalog.count(*) INTO existing_count
  FROM public.live_class_presentations WHERE live_class_id = p_live_class_id;

  SELECT pg_catalog.count(*) INTO matched_count
  FROM public.live_class_presentations
  WHERE live_class_id = p_live_class_id AND id = ANY (p_ordered_ids);

  IF existing_count <> pg_catalog.cardinality(p_ordered_ids) OR matched_count <> existing_count THEN
    RETURN pg_catalog.jsonb_build_object('status', 'order_mismatch');
  END IF;

  UPDATE public.live_class_presentations p
  SET sort_order = o.position - 1
  FROM pg_catalog.unnest(p_ordered_ids) WITH ORDINALITY AS o(id, position)
  WHERE p.id = o.id AND p.live_class_id = p_live_class_id;

  RETURN pg_catalog.jsonb_build_object('status', 'ok');
END;
$$;

-- p_expected_revision NULL keeps older clients working: the page is still merged
-- under the row lock, so writes to different pages never erase each other.
CREATE OR REPLACE FUNCTION public.save_presentation_annotations(
  p_school_id uuid,
  p_live_class_id uuid,
  p_presentation_id uuid,
  p_page integer,
  p_annotations jsonb,
  p_expected_revision integer,
  p_max_bytes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.live_class_presentations%ROWTYPE;
  merged jsonb;
  updated_row public.live_class_presentations%ROWTYPE;
BEGIN
  SELECT * INTO current_row
  FROM public.live_class_presentations
  WHERE id = p_presentation_id AND live_class_id = p_live_class_id AND school_id = p_school_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'not_found');
  END IF;

  IF p_expected_revision IS NOT NULL AND p_expected_revision <> current_row.annotations_revision THEN
    RETURN pg_catalog.jsonb_build_object('status', 'revision_conflict', 'revision', current_row.annotations_revision);
  END IF;

  merged := pg_catalog.jsonb_set(
    COALESCE(current_row.annotations, '{}'::jsonb), ARRAY[p_page::text], p_annotations, true
  );
  IF pg_catalog.octet_length(merged::text) > p_max_bytes THEN
    RETURN pg_catalog.jsonb_build_object('status', 'too_large');
  END IF;

  UPDATE public.live_class_presentations
  SET annotations = merged,
      annotations_revision = current_row.annotations_revision + 1
  WHERE id = p_presentation_id
  RETURNING * INTO updated_row;

  RETURN pg_catalog.jsonb_build_object('status', 'ok', 'presentation', pg_catalog.to_jsonb(updated_row));
END;
$$;

REVOKE ALL ON FUNCTION public.activate_presentation(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_presentation(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reorder_presentations(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_presentations(uuid, uuid, uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.save_presentation_annotations(uuid, uuid, uuid, integer, jsonb, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_presentation_annotations(uuid, uuid, uuid, integer, jsonb, integer, integer) TO service_role;
