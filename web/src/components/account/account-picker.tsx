'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LoaderCircle, RefreshCw } from 'lucide-react'

import { getApiUrl } from '@/config/api'
import { authenticatedApiFetch } from '@/lib/authenticated-fetch'
import { clearActiveAccountId, getActiveAccountId, setActiveAccountId } from '@/lib/account-preference'
import { loginHref } from '@/lib/auth-continuation'
import { AccountSwitcherError, loadMemberships, responseBody } from './account-switcher'

/**
 * Full-page account chooser shown when the API answers
 * ACCOUNT_SELECTION_REQUIRED. After a choice it reloads `returnPath` (already
 * checked with safeRedirectPath) so Server Components read the new cookie.
 */
export function AccountPicker({ returnPath }: { returnPath: string }) {
  const [choosing, setChoosing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const autoSelected = useRef(false)
  const memberships = useQuery({ queryKey: ['account-memberships'], queryFn: loadMemberships, retry: false })

  const handleFailure = (caught: unknown) => {
    if (caught instanceof AccountSwitcherError && caught.code === 'SESSION_EXPIRED') {
      window.location.assign(loginHref({ redirect: returnPath }))
      return
    }
    setError(caught instanceof AccountSwitcherError ? caught.userMessage : 'We could not open that tutoring account. Try again.')
    setChoosing(null)
  }

  const open = async (accountId: string) => {
    const response = await authenticatedApiFetch(`${getApiUrl()}/students/me/centres/${accountId}/select`, { method: 'POST' })
    await responseBody(response, 'We could not open that tutoring account. Try again.')
    setActiveAccountId(accountId)
    window.location.assign(returnPath)
  }

  const choose = (accountId: string) => {
    setError(null)
    setChoosing(accountId)
    open(accountId).catch(handleFailure)
  }

  const singleAccountId = memberships.isSuccess && memberships.data.length === 1 ? memberships.data[0].school_id : null

  useEffect(() => {
    if (!memberships.isSuccess) return
    const stored = getActiveAccountId()
    if (stored && !memberships.data.some(account => account.school_id === stored)) clearActiveAccountId()
    if (!singleAccountId || autoSelected.current) return
    autoSelected.current = true
    open(singleAccountId).catch(handleFailure)
    // open and handleFailure only close over returnPath; running once per load is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships.isSuccess, memberships.data, singleAccountId])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf9f8] px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-[#e3ded9] bg-white p-6 shadow-sm" aria-labelledby="account-picker-title">
        <h1 id="account-picker-title" className="text-2xl font-bold text-[#2e2877]">Choose a tutoring account</h1>
        <p className="mt-2 text-sm leading-6 text-[#4f4a54]">You belong to more than one tutoring account. Pick the one you want to work in. You can switch later from the top bar.</p>
        {memberships.isPending ? <p className="mt-6 flex items-center gap-2 text-sm text-[#716c76]"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Loading accounts…</p> : null}
        {memberships.isError ? <div className="mt-6 space-y-3" role="alert"><p className="text-sm text-[#7c2d12]">{memberships.error instanceof AccountSwitcherError ? memberships.error.userMessage : 'We could not load your tutoring accounts.'}</p><button type="button" onClick={() => void memberships.refetch()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#2e2877] px-3 text-sm font-semibold text-white"><RefreshCw size={15} aria-hidden="true" />Try again</button></div> : null}
        {memberships.isSuccess && memberships.data.length === 0 ? <p className="mt-6 text-sm text-[#716c76]">No active tutoring accounts are available yet.</p> : null}
        {memberships.isSuccess && memberships.data.length > 0 ? <ul className="mt-6 space-y-2">{memberships.data.map(account => (
          <li key={account.id}>
            <button type="button" disabled={Boolean(choosing) || Boolean(singleAccountId)} onClick={() => choose(account.school_id)} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[#ded9d4] px-4 py-3 text-left text-sm hover:bg-[#f5f2ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2e2877] disabled:opacity-60">
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-[#2e2877]">{account.school?.name || 'Tutoring account'}</span><span className="mt-0.5 block text-xs capitalize text-[#77727e]">{account.role}</span></span>
              {choosing === account.school_id ? <LoaderCircle size={16} className="animate-spin text-[#2e2877]" aria-label="Opening" /> : null}
            </button>
          </li>
        ))}</ul> : null}
        {error ? <p className="mt-4 text-sm text-[#7c2d12]" role="alert">{error}</p> : null}
      </section>
    </main>
  )
}
