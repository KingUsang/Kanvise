'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import posthog from 'posthog-js'
import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

const posthogConfigured = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST)

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!posthogConfigured) return

    let identifiedUserId: string | null = null
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_OUT') {
        identifiedUserId = null
        posthog.reset()
        return
      }

      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session) {
        const { user } = session
        if (identifiedUserId && identifiedUserId !== user.id) posthog.reset()
        identifiedUserId = user.id
        posthog.identify(user.id, {
          email: user.email,
          first_name: user.user_metadata.first_name,
          last_name: user.user_metadata.last_name,
          role: user.app_metadata.role,
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes. Switching tabs will NOT
        // trigger a background refetch until stale. Specific queries that need
        // tighter freshness (e.g. live session status) opt in with their own
        // staleTime. Cache is kept in memory for 30 minutes after unmount so
        // navigating back to a page feels instant.
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  }))

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
