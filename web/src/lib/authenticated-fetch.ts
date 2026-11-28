import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { getCurrentAccessToken, refreshAccessToken } from './auth-session'
import { ACCOUNT_CONTEXT_HEADER, getActiveAccountId } from './account-preference'
import { ACCOUNT_PICKER_PATH, ACCOUNT_SELECTION_REQUIRED, accountPickerHref } from './account-cookie'
import { createClient } from './supabase/client'

const refreshes = new WeakMap<SupabaseClient, Promise<string | null>>()

function requestPath(input: RequestInfo | URL) {
  try {
    if (typeof input === 'string') return new URL(input, window.location.origin).pathname
    if (input instanceof URL) return input.pathname
    return new URL(input.url, window.location.origin).pathname
  } catch {
    return 'unknown'
  }
}

function refreshOnce(supabase: SupabaseClient) {
  const existing = refreshes.get(supabase)
  if (existing) return existing
  const refresh = refreshAccessToken(supabase).finally(() => refreshes.delete(supabase))
  refreshes.set(supabase, refresh)
  return refresh
}

async function isExpiredAccessTokenResponse(response: Response) {
  if (response.status !== 401) return false
  const body = await response.clone().json().catch(() => null)
  return body?.code === 'TOKEN_EXPIRED'
}

/**
 * The API answers 409 ACCOUNT_SELECTION_REQUIRED when the person has several
 * active memberships and the request named none. Send the browser to the
 * account picker, returning to the current page, instead of showing an error.
 */
async function openAccountPickerIfRequired(response: Response) {
  if (response.status !== 409 || typeof window === 'undefined') return
  const body = await response.clone().json().catch(() => null)
  if (body?.code !== ACCOUNT_SELECTION_REQUIRED) return
  if (window.location.pathname.startsWith(ACCOUNT_PICKER_PATH)) return
  window.location.assign(accountPickerHref(`${window.location.pathname}${window.location.search}`))
}

/**
 * fetch for callers that build their own Authorization and
 * accountContextHeaders() instead of using authenticatedFetch. It adds only
 * the account picker redirect on 409 ACCOUNT_SELECTION_REQUIRED.
 */
export async function accountScopedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init)
  await openAccountPickerIfRequired(response)
  return response
}

/**
 * Fired on window when an authenticated request finds the sign-in has ended,
 * so the dashboard shell can show "You've been signed out" (SH-14b) while the
 * page stays on screen.
 */
export const SESSION_ENDED_EVENT = 'kanvise:session-ended'

function sessionEndedResponse() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_ENDED_EVENT))
  return new Response(
    JSON.stringify({ error: 'Your session has ended. Please sign in again.', code: 'SESSION_EXPIRED' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  )
}

export async function authenticatedFetch(
  supabase: SupabaseClient,
  input: RequestInfo | URL,
  accessTokenOrInit?: string | RequestInit,
  maybeInit: RequestInit = {},
) {
  const suppliedToken = typeof accessTokenOrInit === 'string' ? accessTokenOrInit : undefined
  const init = typeof accessTokenOrInit === 'string' ? maybeInit : (accessTokenOrInit ?? {})
  const request = async (token: string) => {
    // Normalise then replace the header. A few older callers supplied the
    // server-rendered token themselves; leaving that lower-cased header in
    // place alongside this one causes browsers to combine both values.
    const headers = Object.fromEntries(new Headers(init.headers).entries())
    delete headers.authorization
    delete headers[ACCOUNT_CONTEXT_HEADER.toLowerCase()]
    const activeAccountId = getActiveAccountId()
    if (activeAccountId) headers[ACCOUNT_CONTEXT_HEADER] = activeAccountId
    try {
      const response = await fetch(input, {
        ...init,
        headers: { ...headers, Authorization: `Bearer ${token}` },
      })
      if (response.status === 409 || response.status >= 500) {
        Sentry.captureMessage('Browser API request returned a handled failure', {
          level: response.status >= 500 ? 'error' : 'warning',
          tags: {
            http_status: String(response.status),
            http_method: init.method || 'GET',
            api_path: requestPath(input),
          },
        })
      }
      return response
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          http_method: init.method || 'GET',
          api_path: requestPath(input),
          failure_type: 'network',
        },
      })
      throw error
    }
  }

  const accessToken = suppliedToken ?? await getCurrentAccessToken(supabase)
  if (!accessToken) return sessionEndedResponse()
  let response = await request(accessToken)
  if (await isExpiredAccessTokenResponse(response)) {
    const freshToken = await refreshOnce(supabase)
    if (!freshToken) return sessionEndedResponse()
    response = await request(freshToken)
  }
  await openAccountPickerIfRequired(response)
  return response
}

/** Browser-to-Hono calls must use the current Supabase session, never a token
 * captured when a dashboard route first rendered. */
export function authenticatedApiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return authenticatedFetch(createClient(), input, init)
}
