'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getApiUrl } from '@/config/api'
import { authenticatedApiFetch } from '@/lib/authenticated-fetch'
import { useActiveAccountId } from '@/lib/account-preference'
import { loginHref } from '@/lib/auth-continuation'
import { settingsQueryKeys } from '@/lib/settings-query-keys'
import { SchoolSetupForm } from './school-setup-form'

type SchoolSetupRouteClientProps = {
  mode: 'setup' | 'settings'
}

type SchoolResponse = {
  school: Record<string, unknown> | null
  isConfigured: boolean
}

const SESSION_ENDED_MESSAGE = 'Your session has ended. Please sign in again.'
const SAFE_LOAD_ERROR = 'We could not load your centre details. Please try again.'

class SchoolLoadError extends Error {
  constructor(readonly code: 'SESSION_EXPIRED' | 'INVALID_RESPONSE' | 'UNAVAILABLE') {
    super(code === 'SESSION_EXPIRED' ? SESSION_ENDED_MESSAGE : SAFE_LOAD_ERROR)
  }
}

async function loadSchool({ signal }: { signal?: AbortSignal } = {}): Promise<SchoolResponse> {
  const response = await authenticatedApiFetch(`${getApiUrl()}/schools/me`, { cache: 'no-store', signal })
  const body = await response.json().catch(() => null) as { data?: Record<string, unknown>; error?: string; code?: string } | null

  if (response.ok) return { school: body?.data || null, isConfigured: true }
  if (body?.code === 'SCHOOL_NOT_CONFIGURED' || (response.status === 400 && body?.error === 'User does not belong to a school')) {
    return { school: null, isConfigured: false }
  }
  if (response.status === 401 || body?.code === 'SESSION_EXPIRED') {
    throw new SchoolLoadError('SESSION_EXPIRED')
  }
  throw new SchoolLoadError(response.status >= 400 && response.status < 500 ? 'INVALID_RESPONSE' : 'UNAVAILABLE')
}

function RouteLoading() {
  return <div className="mx-auto flex min-h-[24rem] max-w-[1440px] items-center justify-center px-4 py-10 text-sm text-[#716c76]">Loading your centre details…</div>
}

export function SchoolSetupRouteClient({ mode }: SchoolSetupRouteClientProps) {
  const router = useRouter()
  const accountId = useActiveAccountId()
  const loginPath = loginHref({ redirect: mode === 'settings' ? '/dashboard/settings' : '/dashboard/school-setup' })
  const schoolQuery = useQuery({
    queryKey: settingsQueryKeys.school(accountId),
    queryFn: loadSchool,
    staleTime: 60_000,
    retry: (failureCount, error) => error instanceof SchoolLoadError && error.code === 'UNAVAILABLE' && failureCount < 1,
  })

  useEffect(() => {
    if (mode === 'settings' && schoolQuery.data?.isConfigured === false) {
      router.replace('/dashboard/school-setup')
    }
  }, [mode, router, schoolQuery.data?.isConfigured])

  if (schoolQuery.isPending || (mode === 'settings' && schoolQuery.data?.isConfigured === false)) return <RouteLoading />
  if (schoolQuery.isError) {
    const sessionEnded = schoolQuery.error instanceof SchoolLoadError && schoolQuery.error.code === 'SESSION_EXPIRED'
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center text-sm text-red-800">
        <p>{sessionEnded ? SESSION_ENDED_MESSAGE : SAFE_LOAD_ERROR}</p>
        {sessionEnded ? (
          <button type="button" onClick={() => router.replace(loginPath)} className="mt-4 rounded-lg bg-[#2e2877] px-4 py-2 font-semibold text-white">Sign in again</button>
        ) : (
          <button type="button" onClick={() => void schoolQuery.refetch()} className="mt-4 rounded-lg bg-[#2e2877] px-4 py-2 font-semibold text-white">Try again</button>
        )}
      </div>
    )
  }

  return <div className="animate-in fade-in duration-500"><SchoolSetupForm initialData={schoolQuery.data.school} /></div>
}
