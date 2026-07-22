// Unit tests must never inherit real database credentials from a developer's
// local .env file. These values let the Supabase client be constructed, while
// remaining deliberately unusable for network access.
process.env.SUPABASE_URL = 'https://unit-tests.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-service-role-key'
