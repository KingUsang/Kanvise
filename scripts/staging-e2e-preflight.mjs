import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { assertStagingSafety } from './staging-e2e-safety.mjs'
import { realDeviceMode } from './staging-certification-lib.mjs'

const safe = assertStagingSafety()
const checks = []

async function check(name, action) {
  const started = Date.now()
  await action()
  checks.push({ name, status: 'ok', duration_ms: Date.now() - started })
}

await check('web deployment identity', async () => {
  const response = await fetch(new URL('/api/health', process.env.E2E_BASE_URL), { headers: { 'cache-control': 'no-cache' } })
  const body = await response.json()
  if (!response.ok || body.release_sha !== process.env.E2E_EXPECTED_SHA) throw new Error(`Web release mismatch: ${body.release_sha}`)
})

await check('api deployment identity', async () => {
  const response = await fetch(new URL('/health', process.env.E2E_API_URL), { headers: { 'cache-control': 'no-cache' } })
  const body = await response.json()
  if (!response.ok || body.release_sha !== process.env.E2E_EXPECTED_SHA) throw new Error(`API release mismatch: ${body.release_sha}`)
})

await check('supabase service role', async () => {
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 })
  if (error) throw error
})

await check('r2 private bucket', async () => {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  })
  await client.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME }))
})

await check('gmail readonly mailbox', async () => {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.E2E_GMAIL_CLIENT_ID,
      client_secret: process.env.E2E_GMAIL_CLIENT_SECRET,
      refresh_token: process.env.E2E_GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const token = await tokenResponse.json()
  if (!tokenResponse.ok || !token.access_token) throw new Error(`Gmail token refresh failed (${tokenResponse.status})`)
  const profile = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { authorization: `Bearer ${token.access_token}` } })
  const body = await profile.json()
  if (!profile.ok || body.emailAddress?.toLowerCase() !== process.env.E2E_GMAIL_ADDRESS.toLowerCase()) {
    throw new Error(`Gmail mailbox mismatch (${profile.status})`)
  }
})

const realDevices = realDeviceMode()
if (realDevices.problems.length) throw new Error(realDevices.problems.join('; '))
if (realDevices.enabled) {
  await check('browserstack automate', async () => {
    const authorization = Buffer.from(`${process.env.BROWSERSTACK_USERNAME}:${process.env.BROWSERSTACK_ACCESS_KEY}`).toString('base64')
    const response = await fetch('https://api.browserstack.com/automate/plan.json', { headers: { authorization: `Basic ${authorization}` } })
    if (!response.ok) throw new Error(`BrowserStack credential check failed (${response.status})`)
  })
} else {
  checks.push({ name: 'browserstack automate', status: 'skipped', reason: 'optional; no BrowserStack credentials' })
}

console.log(JSON.stringify({ run_id: safe.runId, checks }, null, 2))
