import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return browserClient
}

/**
 * Admin-generated invite links complete with an implicit-grant URL fragment.
 * Keep the app's normal PKCE client unchanged, and use a one-off implicit
 * client only while consuming that fragment in the invitation callback.
 */
export function createInvitationCallbackClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: false,
      auth: {
        flowType: 'implicit',
        detectSessionInUrl: true,
      },
    },
  )
}
