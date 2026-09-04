export const PUBLIC_APP_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://kanvise.com'
).replace(/\/$/, '')

export function getBrowserAppUrl() {
  // The deployed origin is the source of truth for email callbacks. Prefer
  // the build-time deployment URL so a stale Supabase Site URL cannot send a
  // staging user back to localhost.
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (configuredUrl) return configuredUrl.replace(/\/$/, '')

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return PUBLIC_APP_URL
}

export const PUBLIC_APP_HOST = (() => {
  try {
    return new URL(PUBLIC_APP_URL).host
  } catch {
    return 'kanvise.com'
  }
})()
