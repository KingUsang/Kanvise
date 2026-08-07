const CORE_PRODUCTION_VARIABLES = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'PAYSTACK_SECRET_KEY',
  'KANVISE_INTERNAL_SECRET',
  'INVITE_TOKEN_SECRET',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_BUCKET_NAME',
  'R2_PUBLIC_BASE_URL',
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'GEMINI_API_KEY',
  'FRONTEND_URL',
  'CORS_ALLOWED_ORIGINS',
  'PORT',
] as const

const TELEGRAM_VARIABLES = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_BOT_USERNAME',
  'TELEGRAM_WEBHOOK_SECRET',
] as const

function missingVariables(names: readonly string[], env: NodeJS.ProcessEnv) {
  return names.filter((name) => !env[name]?.trim())
}

function requireHttpsUrl(name: string, value: string | undefined) {
  let url: URL
  try {
    url = new URL(value || '')
  } catch {
    throw new Error(`${name} must be a valid URL in production`)
  }
  if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS in production`)
}

export function isTelegramEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.TELEGRAM_ENABLED === 'true'
}

export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return

  const missing = missingVariables(CORE_PRODUCTION_VARIABLES, env)
  if (isTelegramEnabled(env)) missing.push(...missingVariables(TELEGRAM_VARIABLES, env))
  if (missing.length > 0) {
    throw new Error(`Missing production environment variables: ${[...new Set(missing)].sort().join(', ')}`)
  }

  const port = Number(env.PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535 in production')
  }

  requireHttpsUrl('SUPABASE_URL', env.SUPABASE_URL)
  requireHttpsUrl('R2_PUBLIC_BASE_URL', env.R2_PUBLIC_BASE_URL)
  requireHttpsUrl('FRONTEND_URL', env.FRONTEND_URL)
  requireHttpsUrl('LIVEKIT_URL', env.LIVEKIT_URL?.replace(/^wss:/, 'https:'))
  for (const origin of (env.CORS_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)) {
    requireHttpsUrl('CORS_ALLOWED_ORIGINS', origin)
  }
}
