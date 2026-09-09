-- Publish the immutable version and its initial public-link offer in the same
-- database transaction. A bad/conflicting offer must not leave a mock in a
-- published state without the link the author selected in the builder.
CREATE OR REPLACE FUNCTION public.publish_versioned_mock_with_offer(
  p_school_id UUID,
  p_mock_exam_id UUID,
  p_published_by UUID,
  p_published_at TIMESTAMPTZ,
  p_create_direct_offer BOOLEAN,
  p_direct_slug TEXT,
  p_direct_access_mode TEXT,
  p_direct_price_kobo INTEGER
)
RETURNS TABLE(
  mock_exam_version_id UUID,
  version_number INTEGER,
  total_questions INTEGER,
  total_marks NUMERIC,
  direct_offer_id UUID,
  direct_offer_slug TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version RECORD;
  v_mock public.mock_exams%ROWTYPE;
  v_offer public.mock_access_offers%ROWTYPE;
BEGIN
  SELECT published.* INTO v_version
  FROM public.publish_versioned_mock(
    p_school_id,
    p_mock_exam_id,
    p_published_by,
    p_published_at
  ) AS published;

  SELECT * INTO v_mock
  FROM public.mock_exams
  WHERE id = p_mock_exam_id AND school_id = p_school_id;

  IF p_create_direct_offer THEN
    INSERT INTO public.mock_access_offers (
      school_id,
      created_by,
      mock_exam_id,
      mock_exam_version_id,
      slug,
      audience_scope,
      access_mode,
      price_kobo,
      attempts_included,
      is_active
    ) VALUES (
      p_school_id,
      p_published_by,
      p_mock_exam_id,
      v_version.mock_exam_version_id,
      p_direct_slug,
      'public_link',
      COALESCE(p_direct_access_mode, 'free_claim'),
      CASE WHEN p_direct_access_mode = 'paid' THEN COALESCE(p_direct_price_kobo, 0) ELSE 0 END,
      COALESCE(v_mock.max_attempts, 1),
      TRUE
    )
    RETURNING * INTO v_offer;
  END IF;

  RETURN QUERY SELECT
    v_version.mock_exam_version_id,
    v_version.version_number,
    v_version.total_questions,
    v_version.total_marks,
    v_offer.id,
    v_offer.slug;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_versioned_mock_with_offer(
  UUID, UUID, UUID, TIMESTAMPTZ, BOOLEAN, TEXT, TEXT, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_versioned_mock_with_offer(
  UUID, UUID, UUID, TIMESTAMPTZ, BOOLEAN, TEXT, TEXT, INTEGER
) TO service_role;
