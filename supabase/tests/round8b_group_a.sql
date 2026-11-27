-- Round 8B group A: schema checks for the Class creation fingerprint column and
-- the onboarding scan index. Runs with `supabase test db` in CI.
BEGIN;

SELECT plan(3);

SELECT has_column('public', 'programmes', 'creation_fingerprint', 'programmes.creation_fingerprint exists');
SELECT col_is_null('public', 'programmes', 'creation_fingerprint', 'creation_fingerprint is nullable for pre-existing Classes');
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'user_profiles'
      AND indexname = 'user_profiles_staff_created_at_idx'
  ),
  'user_profiles staff created_at index exists'
);

SELECT * FROM finish();
ROLLBACK;
