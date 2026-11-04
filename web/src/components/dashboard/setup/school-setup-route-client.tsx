'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getApiUrl } from '@/config/api'
import { authenticatedApiFetch } from '@/lib/authenticated-fetch'
import { SchoolSetupForm } from './school-setup-form'

type SchoolSetupRouteClientProps = {
  mode: 'setup' | 'settings'
}

type SchoolResponse = {
  school: Record<string, unknown> | null
  isConfigured: boolean
}

async function loadSchool(): Promise<SchoolResponse> {
  const response = await authenticatedApiFetch(`${getApiUrl()}/schools/me`, { cache: 'no-store' })
  const body = await response.json().catch(() => null) as { data?: Record<string, unknown>; error?: string; code?: string } | null

  if (response.ok) return { school: body?.data || null, isConfigured: true }
  if (body?.code === 'SCHOOL_NOT_CONFIGURED' || (response.status === 400 && body?.error === 'User does not belong to a school')) {
    return { school: null, isConfigured: false }
  }
  if (response.status === 401 || body?.code === 'SESSION_EXPIRED') {
    throw new Error('Your session has ended. Please sign in again.')
  }
  throw new Error(body?.error || 'We could not load your centre details. Please try again.')
}

function RouteLoading() {
  return <main className="mx-auto flex min-h-[24rem] max-w-[1440px] items-center justify-center px-4 py-10 text-sm text-[#716c76]">Loading your centre details…</main>
}

export function SchoolSetupRouteClient({ mode }: SchoolSetupRouteClientProps) {
  const router = useRouter()
  const schoolQuery = useQuery({
    queryKey: ['dashboard-school'],
    queryFn: loadSchool,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (mode === 'settings' && schoolQuery.data?.isConfigured === false) {
      router.replace('/dashboard/school-setup')
    }
  }, [mode, router, schoolQuery.data?.isConfigured])

  if (schoolQuery.isPending || (mode === 'settings' && schoolQuery.data?.isConfigured === false)) return <RouteLoading />
  if (schoolQuery.isError) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 text-center text-sm text-red-800">
        <p>{schoolQuery.error instanceof Error ? schoolQuery.error.message : 'We could not load your centre details.'}</p>
        <button type="button" onClick={() => void schoolQuery.refetch()} className="mt-4 rounded-lg bg-[#2e2877] px-4 py-2 font-semibold text-white">Try again</button>
      </main>
    )
  }

  return <div className="animate-in fade-in duration-500"><SchoolSetupForm initialData={schoolQuery.data.school} /></div>
}
