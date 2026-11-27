-- Slice 6B: smoke checks for the atomic assignment and presentation functions
-- and the notes unique index. Runs with `supabase test db` in CI. These checks
-- need no fixture rows; row-locking order under concurrency is not covered.
BEGIN;

SELECT plan(10);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'notes'
      AND indexname = 'notes_school_file_key_unique_idx'
      AND indexdef ILIKE '%UNIQUE%'
  ),
  'notes (school_id, file_key) unique index exists'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.submit_assignment(uuid, uuid, uuid, text, text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.submit_assignment(uuid, uuid, uuid, text, text)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.submit_assignment(uuid, uuid, uuid, text, text)', 'EXECUTE'),
  'submit_assignment is service_role only'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.save_presentation_annotations(uuid, uuid, uuid, integer, jsonb, integer, integer)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.save_presentation_annotations(uuid, uuid, uuid, integer, jsonb, integer, integer)', 'EXECUTE'),
  'save_presentation_annotations is service_role only'
);

SELECT is(
  public.update_assignment_guarded(gen_random_uuid(), gen_random_uuid(), 't', NULL, now() + interval '1 day')->>'status',
  'not_found', 'update_assignment_guarded reports a missing assignment'
);
SELECT is(
  public.delete_assignment_guarded(gen_random_uuid(), gen_random_uuid())->>'status',
  'not_found', 'delete_assignment_guarded reports a missing assignment'
);
SELECT is(
  public.submit_assignment(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'k', 'f.pdf')->>'status',
  'not_found', 'submit_assignment reports a missing assignment'
);
SELECT is(
  public.reorder_presentations(gen_random_uuid(), gen_random_uuid(), ARRAY[gen_random_uuid()])->>'status',
  'not_found', 'reorder_presentations reports a missing live class'
);
SELECT is(
  public.activate_presentation(gen_random_uuid(), gen_random_uuid(), gen_random_uuid())->>'status',
  'not_found', 'activate_presentation reports a missing live class'
);
SELECT is(
  public.save_presentation_annotations(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1, NULL, NULL, 1000)->>'status',
  'invalid', 'save_presentation_annotations rejects a null annotation payload'
);
SELECT is(
  public.save_presentation_annotations(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1, '[]'::jsonb, NULL, 1000)->>'status',
  'not_found', 'save_presentation_annotations reports a missing material'
);

SELECT * FROM finish();
ROLLBACK;
