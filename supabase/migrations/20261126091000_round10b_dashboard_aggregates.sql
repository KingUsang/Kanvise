-- Round 10B: bounded dashboard aggregates (DEV-DSH-003, DEV-DSH-008). One grouped
-- query replaces two count queries per assignment, and ranks every eligible
-- assignment instead of an arbitrary sample of 20. Service-role only. Nothing here
-- depends on legacy RLS policies or current_user_school_id().

-- Assignments with ungraded submissions, most pending first. p_tutor_id NULL means
-- the whole account.
CREATE OR REPLACE FUNCTION public.dashboard_needs_grading(
  p_school_id uuid, p_tutor_id uuid DEFAULT NULL, p_limit integer DEFAULT 3
) RETURNS TABLE (
  out_assignment_id uuid, out_title text, out_course_name text, out_pending_count integer, out_total_count integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT a.id, a.title::text, c.name::text,
         (count(*) FILTER (WHERE s.score IS NULL))::integer,
         count(*)::integer
  FROM public.assignments a
  JOIN public.submissions s ON s.assignment_id = a.id AND s.school_id = a.school_id
  LEFT JOIN public.courses c ON c.id = a.course_id
  WHERE a.school_id = p_school_id
    AND (p_tutor_id IS NULL OR a.tutor_id = p_tutor_id)
  GROUP BY a.id, a.title, c.name
  HAVING count(*) FILTER (WHERE s.score IS NULL) > 0
  ORDER BY count(*) FILTER (WHERE s.score IS NULL) DESC, a.id
  LIMIT greatest(p_limit, 0);
$$;

-- Ungraded submissions across a Tutor's assignments (or the whole account).
CREATE OR REPLACE FUNCTION public.dashboard_pending_submissions(
  p_school_id uuid, p_tutor_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::integer
  FROM public.submissions s
  JOIN public.assignments a ON a.id = s.assignment_id AND a.school_id = s.school_id
  WHERE s.school_id = p_school_id
    AND s.score IS NULL
    AND (p_tutor_id IS NULL OR a.tutor_id = p_tutor_id);
$$;

REVOKE ALL ON FUNCTION public.dashboard_needs_grading(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dashboard_pending_submissions(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_needs_grading(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_pending_submissions(uuid, uuid) TO service_role;
