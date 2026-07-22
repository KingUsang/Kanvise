const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_HONO_API_URL

export function getApiUrl() {
  if (!configuredApiUrl) {
    throw new Error('Kanvise API URL is not configured. Set NEXT_PUBLIC_API_URL in the deployment environment.')
  }

  try {
    return new URL(configuredApiUrl).toString().replace(/\/$/, '')
  } catch {
    throw new Error('NEXT_PUBLIC_API_URL must be a complete URL, for example https://api.kanvise.com')
  }
}
