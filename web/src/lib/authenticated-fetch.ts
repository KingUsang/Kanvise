import type { SupabaseClient } from '@supabase/supabase-js'
import { getCurrentAccessToken, refreshAccessToken } from './auth-session'
import { createClient } from './supabase/client'

const refreshes = new WeakMap<SupabaseClient, Promise<string | null>>()

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

function sessionEndedResponse() {
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
  const request = (token: string) => fetch(input, {
    ...init,
    headers: { ...Object.fromEntries(new Headers(init.headers).entries()), Authorization: `Bearer ${token}` },
  })

  const accessToken = suppliedToken ?? await getCurrentAccessToken(supabase)
  if (!accessToken) return new Response(null, { status: 401, statusText: 'Unauthenticated' })
  let response = await request(accessToken)
  if (!await isExpiredAccessTokenResponse(response)) return response

  const freshToken = await refreshOnce(supabase)
  if (!freshToken) return sessionEndedResponse()
  response = await request(freshToken)
  return response
}

/** Browser-to-Hono calls must use the current Supabase session, never a token
 * captured when a dashboard route first rendered. */
export function authenticatedApiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return authenticatedFetch(createClient(), input, init)
}
