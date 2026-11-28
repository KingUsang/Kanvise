import { getApiUrl } from '@/config/api'

/**
 * The public unsubscribe page's calls (18 NTF-04, NTF-08). No sign-in. The
 * token goes in the request body, never in an API URL (standard 03).
 */
export type UnsubscribeAnswer =
  | { state: 'expired' }
  | { state: 'subscribed' | 'unsubscribed'; row_label: string }

export class UnsubscribeRequestError extends Error {}

async function call(path: '/lookup' | '' | '/undo', token: string): Promise<UnsubscribeAnswer> {
  let response: Response
  try {
    response = await fetch(`${getApiUrl()}/unsubscribe${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
  } catch {
    throw new UnsubscribeRequestError('network')
  }
  const body = await response.json().catch(() => null) as { data?: UnsubscribeAnswer } | null
  const data = body?.data
  if (!response.ok || !data || !['expired', 'subscribed', 'unsubscribed'].includes(data.state)) {
    throw new UnsubscribeRequestError(String(response.status))
  }
  if (data.state !== 'expired' && typeof data.row_label !== 'string') throw new UnsubscribeRequestError('shape')
  return data
}

export const lookupUnsubscribe = (token: string) => call('/lookup', token)
export const confirmUnsubscribe = (token: string) => call('', token)
export const undoUnsubscribe = (token: string) => call('/undo', token)

const TOKEN_KEY = 'kanvise-unsubscribe-token'

/**
 * Read the token from ?token= once, keep it for this tab only, and take it
 * out of the address bar so it doesn't end up in history, analytics or a
 * shared screenshot. A reload reads it back from this tab's storage.
 */
export function takeUnsubscribeToken(): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const fromUrl = url.searchParams.get('token')
  try {
    if (fromUrl) {
      window.sessionStorage.setItem(TOKEN_KEY, fromUrl)
      url.searchParams.delete('token')
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
      return fromUrl
    }
    return window.sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return fromUrl
  }
}
