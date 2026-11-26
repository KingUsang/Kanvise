'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, LoaderCircle, RefreshCw } from 'lucide-react'

import { getApiUrl } from '@/config/api'
import { authenticatedApiFetch } from '@/lib/authenticated-fetch'
import {
  clearActiveAccountId,
  getActiveAccountId,
  isValidAccountId,
  setActiveAccountId,
  subscribeToActiveAccount,
} from '@/lib/account-preference'
import { loginHref } from '@/lib/auth-continuation'

export type AccountMembership = {
  id: string
  school_id: string
  role: 'admin' | 'tutor' | 'learner'
  joined_at: string
  school: { id: string; name: string } | null
  active?: boolean
}

export class AccountSwitcherError extends Error {
  constructor(readonly code: string, readonly userMessage: string) {
    super(userMessage)
    this.name = 'AccountSwitcherError'
  }
}

function safeApiMessage(code: unknown, fallback: string) {
  if (code === 'SESSION_EXPIRED') return 'Your session has ended. Please sign in again.'
  if (code === 'FORBIDDEN' || code === 'ACCOUNT_ACCESS_DENIED') return 'That tutoring account is no longer available.'
  if (code === 'CENTRES_UNAVAILABLE' || code === 'CENTRE_SELECTION_UNAVAILABLE') return 'We could not verify your tutoring accounts. Try again.'
  return fallback
}

export async function responseBody(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { data?: unknown; code?: string } | null
  if (!response.ok) throw new AccountSwitcherError(body?.code || 'ACCOUNT_SWITCH_FAILED', safeApiMessage(body?.code, fallback))
  return body
}

function parseMemberships(body: { data?: unknown } | null) {
  if (!Array.isArray(body?.data)) throw new AccountSwitcherError('INVALID_ACCOUNT_RESPONSE', 'We could not read your tutoring accounts. Try again.')
  return body.data.flatMap((value): AccountMembership[] => {
    if (!value || typeof value !== 'object') return []
    const item = value as Partial<AccountMembership>
    if (typeof item.id !== 'string' || !isValidAccountId(item.school_id) || !['admin', 'tutor', 'learner'].includes(item.role || '') || typeof item.joined_at !== 'string') return []
    const school = item.school && typeof item.school === 'object' && isValidAccountId(item.school.id) && typeof item.school.name === 'string'
      ? { id: item.school.id, name: item.school.name }
      : null
    return [{ id: item.id, school_id: item.school_id, role: item.role as AccountMembership['role'], joined_at: item.joined_at, school, active: item.active === true }]
  })
}

export async function loadMemberships() {
  try {
    const response = await authenticatedApiFetch(`${getApiUrl()}/students/me/centres?limit=100`, { cache: 'no-store' })
    return parseMemberships(await responseBody(response, 'We could not load your tutoring accounts. Try again.'))
  } catch (error) {
    if (error instanceof AccountSwitcherError) throw error
    throw new AccountSwitcherError('ACCOUNT_LIST_UNAVAILABLE', 'We could not load your tutoring accounts. Check your connection and try again.')
  }
}

function useAccountMemberships() {
  const [preferredAccountId, setPreferredAccountId] = useState(getActiveAccountId)
  useEffect(() => subscribeToActiveAccount(() => setPreferredAccountId(getActiveAccountId())), [])

  const query = useQuery({ queryKey: ['account-memberships'], queryFn: loadMemberships, staleTime: 5 * 60_000, retry: false })
  const selected = useMemo(() => {
    if (!query.data?.length) return null
    // A stored selection is kept only while it is still an active membership.
    // Otherwise the only membership is chosen automatically; with several the
    // person picks one (the API answers ACCOUNT_SELECTION_REQUIRED meanwhile).
    return query.data.find(account => account.school_id === preferredAccountId) || (query.data.length === 1 ? query.data[0] : null)
  }, [preferredAccountId, query.data])

  useEffect(() => {
    if (!query.isSuccess) return
    const nextAccountId = selected?.school_id || null
    if (nextAccountId === preferredAccountId) return
    if (nextAccountId) setActiveAccountId(nextAccountId)
    else clearActiveAccountId()
  }, [preferredAccountId, query.isSuccess, selected])

  return { ...query, selected }
}

export function AccountSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const memberships = useAccountMemberships()

  const selectAccount = async (accountId: string) => {
    if (accountId === memberships.selected?.school_id || switchingTo) {
      setOpen(false)
      return
    }
    setSwitchError(null)
    setSwitchingTo(accountId)
    try {
      const response = await authenticatedApiFetch(`${getApiUrl()}/students/me/centres/${accountId}/select`, { method: 'POST' })
      await responseBody(response, 'We could not switch tutoring accounts. Try again.')
      setActiveAccountId(accountId)
      await queryClient.cancelQueries()
      queryClient.clear()
      setOpen(false)
    } catch (error) {
      if (error instanceof AccountSwitcherError && error.code === 'SESSION_EXPIRED') {
        router.replace(loginHref({ redirect: `${pathname}${window.location.search}` }))
        return
      }
      setSwitchError(error instanceof AccountSwitcherError ? error.userMessage : 'We could not switch tutoring accounts. Try again.')
    } finally {
      setSwitchingTo(null)
    }
  }

  const currentName = memberships.selected?.school?.name || 'Choose tutoring account'
  const isLoading = memberships.isPending || Boolean(switchingTo)

  return (
    <div className="relative">
      <button type="button" aria-label="Choose tutoring account" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(value => !value)} className={`flex min-h-10 max-w-64 items-center gap-2 rounded-xl border border-[#ded9d4] bg-white px-3 text-left text-sm text-[#2e2877] hover:bg-[#f8f6f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2e2877] ${compact ? 'max-w-48' : ''}`}>
        {isLoading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
        <span className="min-w-0 flex-1 truncate font-semibold">{currentName}</span><ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-[#e3ded9] bg-white shadow-xl" role="listbox" aria-label="Tutoring accounts">
        <div className="border-b border-[#eeeae6] px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#77727e]">Tutoring account</p><p className="mt-1 text-sm text-[#4f4a54]">Choose where this workspace should operate.</p></div>
        {memberships.isPending ? <p className="px-4 py-4 text-sm text-[#716c76]">Loading accounts…</p> : null}
        {memberships.isError ? <div className="space-y-3 px-4 py-4" role="alert"><p className="text-sm text-[#7c2d12]">{memberships.error instanceof AccountSwitcherError ? memberships.error.userMessage : 'We could not load your tutoring accounts.'}</p><button type="button" onClick={() => void memberships.refetch()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#2e2877] px-3 text-sm font-semibold text-white"><RefreshCw size={15} />Try again</button></div> : null}
        {memberships.isSuccess && memberships.data.length === 0 ? <p className="px-4 py-4 text-sm text-[#716c76]">No active tutoring accounts are available yet.</p> : null}
        {memberships.isSuccess && memberships.data.length > 0 ? <div className="max-h-72 overflow-y-auto p-2">{memberships.data.map(account => {
          const isSelected = account.school_id === memberships.selected?.school_id
          return <button key={account.id} type="button" role="option" aria-selected={isSelected} disabled={isLoading} onClick={() => void selectAccount(account.school_id)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-[#f5f2ef] focus-visible:outline-2 focus-visible:outline-[#2e2877] disabled:opacity-60"><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-[#2e2877]">{account.school?.name || 'Tutoring account'}</span><span className="mt-0.5 block text-xs capitalize text-[#77727e]">{account.role}</span></span>{isSelected ? <Check size={17} className="shrink-0 text-[#2e2877]" aria-label="Selected" /> : null}</button>
        })}</div> : null}
        {switchError ? <p className="border-t border-[#eeeae6] px-4 py-3 text-sm text-[#7c2d12]" role="alert">{switchError}</p> : null}
      </div> : null}
    </div>
  )
}
