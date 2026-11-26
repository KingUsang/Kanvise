import { realDeviceMode } from './staging-certification-lib.mjs'

const required = [
  'E2E_BASE_URL',
  'E2E_API_URL',
  'E2E_EXPECTED_SHA',
  'E2E_RUN_ID',
  'E2E_ALLOWED_SUPABASE_HOST',
  'E2E_ALLOWED_R2_BUCKET',
  'E2E_GMAIL_CLIENT_ID',
  'E2E_GMAIL_CLIENT_SECRET',
  'E2E_GMAIL_REFRESH_TOKEN',
  'E2E_GMAIL_ADDRESS',
  'E2E_ACCOUNT_PASSWORD',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'PAYSTACK_SECRET_KEY',
]

const missing = required.filter((name) => !process.env[name]?.trim())
if (missing.length) {
  console.error(`Missing Staging E2E configuration: ${missing.join(', ')}`)
  process.exit(1)
}

const realDevices = realDeviceMode()
if (realDevices.problems.length) {
  console.error(realDevices.problems.join('\n'))
  process.exit(1)
}

if (!/^https:\/\/staging\./.test(process.env.E2E_BASE_URL)) {
  throw new Error(`Refusing to run against non-staging web origin: ${process.env.E2E_BASE_URL}`)
}
if (!/^https:\/\/staging[-.]/.test(process.env.E2E_API_URL)) {
  throw new Error(`Refusing to run against non-staging API origin: ${process.env.E2E_API_URL}`)
}
if (!/^E2E-[A-Za-z0-9._-]+$/.test(process.env.E2E_RUN_ID)) {
  throw new Error('E2E_RUN_ID must start with E2E- and contain only safe identifier characters')
}
if (!/^[0-9a-f]{40}$/.test(process.env.E2E_EXPECTED_SHA)) {
  throw new Error('E2E_EXPECTED_SHA must be a full Git commit SHA')
}

console.log(`Validated staging E2E configuration for ${process.env.E2E_RUN_ID}`)
console.log(realDevices.enabled ? 'BrowserStack real-device journeys enabled' : 'BrowserStack real-device journeys skipped (optional; no credentials)')
