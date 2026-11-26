import path from 'node:path'

export function requireRunId(value) {
  if (!value || !/^E2E-[A-Za-z0-9._-]+$/.test(value)) throw new Error('Unsafe or missing E2E_RUN_ID')
  return value
}

export function assertStagingSafety(env = process.env) {
  const runId = requireRunId(env.E2E_RUN_ID)
  const supabase = new URL(env.SUPABASE_URL)
  const web = new URL(env.E2E_BASE_URL)
  const api = new URL(env.E2E_API_URL)
  const allowedSupabaseHost = env.E2E_ALLOWED_SUPABASE_HOST
  const allowedBucket = env.E2E_ALLOWED_R2_BUCKET

  if (web.protocol !== 'https:' || !web.hostname.startsWith('staging.')) throw new Error(`Refusing web origin ${web.origin}`)
  if (api.protocol !== 'https:' || !api.hostname.startsWith('staging-')) throw new Error(`Refusing API origin ${api.origin}`)
  if (!allowedSupabaseHost || supabase.host !== allowedSupabaseHost) throw new Error(`Supabase host ${supabase.host} is not explicitly allowed`)
  if (!allowedBucket || env.R2_BUCKET_NAME !== allowedBucket) throw new Error(`R2 bucket ${env.R2_BUCKET_NAME} is not explicitly allowed`)
  if (env.PAYSTACK_SECRET_KEY && !env.PAYSTACK_SECRET_KEY.startsWith('sk_test_')) throw new Error('Paystack key is not test mode')

  return { runId, supabaseHost: supabase.host, bucket: allowedBucket }
}

export function resolveManifestPath(input, env = process.env) {
  const runId = requireRunId(env.E2E_RUN_ID)
  const resolved = path.resolve(input)
  if (path.basename(resolved) !== `${runId}.manifest.json`) throw new Error('Manifest filename does not match E2E_RUN_ID')
  return resolved
}
