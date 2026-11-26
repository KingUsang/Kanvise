// Headers the Next.js route handlers add when they proxy a public request to
// the API, so the API rate limits the visitor rather than the web server
// (DEV-PUB-004). The API trusts X-Kanvise-Client-Ip only when
// X-Kanvise-Proxy-Secret matches its own KANVISE_PROXY_SECRET.
//
// Server-only: KANVISE_PROXY_SECRET has no NEXT_PUBLIC_ prefix, so it is never
// bundled for the browser. Import this module only from route handlers.

export const PROXY_CLIENT_IP_HEADER = 'X-Kanvise-Client-Ip'
export const PROXY_SECRET_HEADER = 'X-Kanvise-Proxy-Secret'

type HeaderSource = { headers: { get(name: string): string | null } }

/**
 * The visitor address as seen by Vercel. Vercel sets x-real-ip and replaces
 * x-forwarded-for at its edge, so the first entry is the visitor and a caller
 * cannot inject an earlier hop.
 */
export function visitorAddress(request: HeaderSource) {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
}

/**
 * Returns the client address and proxy secret headers, or nothing when the
 * secret is not configured (the API then ignores forwarded addresses anyway).
 */
/** Same minimum the API applies; a shorter secret is ignored there. */
export const MIN_PROXY_SECRET_LENGTH = 16
let warnedShortSecret = false

export function proxyClientHeaders(request: HeaderSource, secret = process.env.KANVISE_PROXY_SECRET): Record<string, string> {
  const configured = secret?.trim()
  const address = visitorAddress(request)
  if (configured && configured.length < MIN_PROXY_SECRET_LENGTH) {
    if (!warnedShortSecret) {
      warnedShortSecret = true
      console.warn(`KANVISE_PROXY_SECRET is shorter than ${MIN_PROXY_SECRET_LENGTH} characters and is not sent; the API rate limits all proxied visitors as one client.`)
    }
    return {}
  }
  if (!configured || !address) return {}
  return { [PROXY_CLIENT_IP_HEADER]: address, [PROXY_SECRET_HEADER]: configured }
}
