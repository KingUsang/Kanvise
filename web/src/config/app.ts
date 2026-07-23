export const PUBLIC_APP_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://kanvise.com'
).replace(/\/$/, '')

export function getBrowserAppUrl() {
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
