import assert from 'node:assert/strict'
import test from 'node:test'
import { assertStagingSafety, requireRunId, resolveManifestPath } from './staging-e2e-safety.mjs'

const safeEnv = {
  E2E_RUN_ID: 'E2E-42-1',
  E2E_BASE_URL: 'https://staging.kanvise.com',
  E2E_API_URL: 'https://staging-api.kanvise.com',
  SUPABASE_URL: 'https://staging-project.supabase.co',
  E2E_ALLOWED_SUPABASE_HOST: 'staging-project.supabase.co',
  R2_BUCKET_NAME: 'kanvise-staging',
  E2E_ALLOWED_R2_BUCKET: 'kanvise-staging',
  PAYSTACK_SECRET_KEY: 'sk_test_safe',
}

test('accepts an explicitly allowlisted staging environment', () => {
  assert.deepEqual(assertStagingSafety(safeEnv), {
    runId: 'E2E-42-1',
    supabaseHost: 'staging-project.supabase.co',
    bucket: 'kanvise-staging',
  })
})

test('refuses production and non-test payment configuration', () => {
  assert.throws(() => assertStagingSafety({ ...safeEnv, E2E_BASE_URL: 'https://kanvise.com' }), /Refusing web origin/)
  assert.throws(() => assertStagingSafety({ ...safeEnv, PAYSTACK_SECRET_KEY: 'sk_live_nope' }), /not test mode/)
  assert.throws(() => assertStagingSafety({ ...safeEnv, SUPABASE_URL: 'https://other.supabase.co' }), /not explicitly allowed/)
})

test('binds cleanup input to the current run id', () => {
  assert.equal(requireRunId('E2E-safe'), 'E2E-safe')
  assert.throws(() => requireRunId('safe'), /Unsafe/)
  assert.throws(() => resolveManifestPath('/tmp/E2E-other.manifest.json', safeEnv), /does not match/)
})
