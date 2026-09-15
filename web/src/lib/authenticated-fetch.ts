import type { SupabaseClient } from '@supabase/supabase-js'
import { getCurrentAccessToken, refreshAccessToken } from './auth-session'

const refreshes = new WeakMap<SupabaseClient, Promise<string | null>>()

function refreshOnce(supabase: SupabaseClient) {
  const existing = refreshes.get(supabase)
  if (existing) return existing
  const refresh = refreshAccessToken(supabase).finally(() => refreshes.delete(supabase))
  refreshes.set(supabase, refresh)
  return refresh
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
  if (response.status !== 401) return response

  const freshToken = await refreshOnce(supabase)
  if (!freshToken) return response
  response = await request(freshToken)
  return response
}
