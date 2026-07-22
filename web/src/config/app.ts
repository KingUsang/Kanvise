export const PUBLIC_APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://kanvise.com').replace(/\/$/, '')

export const PUBLIC_APP_HOST = (() => {
  try {
    return new URL(PUBLIC_APP_URL).host
  } catch {
    return 'kanvise.com'
  }
})()
