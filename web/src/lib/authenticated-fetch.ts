import type { SupabaseClient } from '@supabase/supabase-js'

export async function authenticatedFetch(
  supabase: SupabaseClient,
  input: RequestInfo | URL,
  accessToken: string,
  init: RequestInit = {},
) {
  const request = (token: string) => fetch(input, {
    ...init,
    headers: { ...Object.fromEntries(new Headers(init.headers).entries()), Authorization: `Bearer ${token}` },
  })

  let response = await request(accessToken)
  if (response.status !== 401) return response

  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session?.access_token) return response
  response = await request(data.session.access_token)
  return response
}
