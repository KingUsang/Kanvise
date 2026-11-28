/**
 * Email footers and sender names (18 NTF-04).
 *
 * Every email has exactly one footer:
 * - essential emails (NTF-01 Default **Always**) say why they were sent;
 * - emails that can be switched off carry an Unsubscribe link, and the
 *   List-Unsubscribe headers mail apps use for their own unsubscribe button.
 */

export type EmailFooter =
  | { kind: 'essential'; reason: string }
  | { kind: 'unsubscribe'; unsubscribeUrl: string }

/** The links for one switchable email, built from one unsubscribe token. */
export type UnsubscribeLinks = {
  /** The web page the footer link opens (`/unsubscribe?token=`). */
  pageUrl: string
  /** RFC 8058 one-click endpoint on the API, when API_PUBLIC_URL is set. */
  oneClickUrl: string | null
}

function origin(value: string | undefined): string | null {
  const configured = value?.trim()
  if (!configured) return null
  try {
    const url = new URL(configured)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`
  } catch {
    return null
  }
}

export function buildUnsubscribeLinks(token: string, env: NodeJS.ProcessEnv = process.env): UnsubscribeLinks {
  const frontend = origin(env.FRONTEND_URL)
  if (!frontend) throw new Error('FRONTEND_URL is required for unsubscribe links')
  const api = origin(env.API_PUBLIC_URL)
  const encoded = encodeURIComponent(token)
  return {
    pageUrl: `${frontend}/unsubscribe?token=${encoded}`,
    oneClickUrl: api ? `${api}/unsubscribe/one-click?token=${encoded}` : null,
  }
}

/**
 * Headers for a switchable email. With the API's public URL known, mail apps
 * get RFC 8058 one-click unsubscribe. Without it, List-Unsubscribe points at
 * the web page, which mail apps open in a browser.
 */
export function unsubscribeHeaders(links: UnsubscribeLinks): Record<string, string> {
  if (links.oneClickUrl) {
    return {
      'List-Unsubscribe': `<${links.oneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
  }
  return { 'List-Unsubscribe': `<${links.pageUrl}>` }
}

const MAX_DISPLAY_NAME = 70

/**
 * '"Michael Chen via Kanvise" <hello@kanvise.com>'. Quotes, angle brackets,
 * backslashes and line breaks are removed from the name so it can't break the
 * header, and the name is cut to a readable length.
 */
export function formatFrom(displayName: string | null | undefined, address: string): string {
  const mailbox = address.trim().match(/<([^<>]+)>\s*$/)?.[1]?.trim() ?? address.trim()
  const name = (displayName ?? '')
    .replace(/[\u0000-\u001f\u007f"<>\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name) return address
  const suffix = ' via Kanvise'
  const room = MAX_DISPLAY_NAME - suffix.length
  const short = name.length > room ? `${name.slice(0, room - 1).trimEnd()}…` : name
  return `"${short}${suffix}" <${mailbox}>`
}
