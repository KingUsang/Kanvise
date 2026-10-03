const LOCAL_DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Visual QA and the local web dev server may deliberately run on a spare
  // port while the API retains 3001. Keep this development-only pair explicit
  // rather than weakening the production origin allow-list.
  'http://localhost:3100',
  'http://127.0.0.1:3100',
]

function normaliseOrigin(value: string) {
  return value.trim().replace(/\/$/, '')
}

export function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env) {
  const configured = [env.FRONTEND_URL, ...(env.CORS_ALLOWED_ORIGINS || '').split(',')]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normaliseOrigin)

  return new Set([...configured, ...LOCAL_DEVELOPMENT_ORIGINS])
}

export function resolveCorsOrigin(origin: string, env: NodeJS.ProcessEnv = process.env) {
  const normalisedOrigin = normaliseOrigin(origin)

  if (getAllowedOrigins(env).has(normalisedOrigin)) return normalisedOrigin

  // Vercel creates a different hostname for each preview deployment. These
  // origins still use HTTPS and are limited to Vercel's own domain.
  if (normalisedOrigin.startsWith('https://') && normalisedOrigin.endsWith('.vercel.app')) {
    return normalisedOrigin
  }

  return undefined
}
