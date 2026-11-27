-- Round 10B: sweep consumed upload intents whose object was never registered
-- (DEV-UPL-003). An intent is consumed when the client confirms, but the row that
-- owns the object is written afterwards; a crash or a failed release between the
-- two leaves a consumed intent and an unowned object. Service-role only. Does not
-- depend on legacy RLS policies or current_user_school_id().

-- Private client upload types only. Public intents are registered as URLs and are
-- left to their own cleanup. The grace window keeps in-flight registrations safe.
CREATE OR REPLACE FUNCTION public.sweep_unregistered_upload_intents(
  p_older_than interval DEFAULT interval '24 hours', p_limit integer DEFAULT 100
) RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH candidates AS (
    SELECT i.id FROM public.upload_intents i
    WHERE i.status = 'consumed'
      AND i.scope = 'private'
      AND i.entity_type IN ('note', 'assignment_attachment', 'submission', 'question_media')
      AND i.consumed_at < now() - p_older_than
      AND NOT EXISTS (SELECT 1 FROM public.notes n WHERE n.file_key = i.file_key)
      AND NOT EXISTS (SELECT 1 FROM public.assignments a WHERE a.attachment_file_key = i.file_key)
      AND NOT EXISTS (SELECT 1 FROM public.submissions s WHERE s.file_key = i.file_key)
      AND NOT EXISTS (SELECT 1 FROM public.direct_assignments da WHERE da.attachment_file_key = i.file_key)
      AND NOT EXISTS (SELECT 1 FROM public.direct_assignment_submissions ds WHERE ds.file_key = i.file_key)
      AND NOT EXISTS (SELECT 1 FROM public.question_media m WHERE m.storage_key = i.file_key)
    ORDER BY i.consumed_at
    LIMIT p_limit
    FOR UPDATE OF i SKIP LOCKED
  ), expired AS (
    UPDATE public.upload_intents u
    SET status = 'expired'
    FROM candidates c
    WHERE u.id = c.id
    RETURNING u.school_id, u.file_key
  ), queued AS (
    INSERT INTO public.durable_jobs (job_type, dedupe_key, payload)
    SELECT
      'delete_private_object',
      'delete_private_object:' || file_key,
      jsonb_build_object('fileKey', file_key, 'schoolId', school_id)
    FROM expired
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer FROM expired;
$$;

REVOKE ALL ON FUNCTION public.sweep_unregistered_upload_intents(interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_unregistered_upload_intents(interval, integer) TO service_role;
