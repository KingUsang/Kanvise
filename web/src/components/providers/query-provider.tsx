'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
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
