export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  try {
    const url = new URL(value, 'https://kanvise.invalid')
    if (url.origin !== 'https://kanvise.invalid' || url.pathname.startsWith('/auth')) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}
