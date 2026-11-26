-- feature_suggestions is tracked in migrations and reachable only by the service role.
BEGIN;

SELECT plan(7);

SELECT has_table('public', 'feature_suggestions', 'feature_suggestions table exists');

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.feature_suggestions'::regclass),
  true,
  'RLS is enabled on feature_suggestions'
);

SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'feature_suggestions'),
  0,
  'feature_suggestions has no policies'
);

SELECT has_column('public', 'feature_suggestions', 'suggestion', 'suggestion column exists');

SELECT is(
  (SELECT count(*)::int
   FROM unnest(ARRAY['anon', 'authenticated']) AS r(role_name)
   CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS p(priv)
   WHERE has_table_privilege(r.role_name, 'public.feature_suggestions', p.priv)),
  0,
  'anon and authenticated hold no table privileges'
);

SELECT is(
  (SELECT count(*)::int
   FROM unnest(ARRAY['anon', 'authenticated']) AS r(role_name)
   WHERE has_any_column_privilege(r.role_name, 'public.feature_suggestions', 'SELECT, INSERT, UPDATE, REFERENCES')),
  0,
  'anon and authenticated hold no column privileges'
);

SELECT is(
  (SELECT count(*)::int FROM pg_constraint
   WHERE conrelid = 'public.feature_suggestions'::regclass
     AND conname IN ('feature_suggestions_suggestion_length_check', 'feature_suggestions_email_length_check')),
  2,
  'size limit constraints exist'
);

SELECT * FROM finish();
ROLLBACK;
