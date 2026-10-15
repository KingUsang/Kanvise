'use client'

import { Bell, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { enableBrowserPush, getBrowserPushState, type BrowserPushState } from '@/lib/push-notifications'
import { getCurrentAccessToken } from '@/lib/auth-session'
import { BROWSER_PUSH_ELIGIBLE_EVENT, isBrowserPushEligible } from '@/lib/pwa/browser-push-eligibility'
import { createClient } from '@/lib/supabase/client'

const DISMISSED_KEY = 'kanvise-browser-push-prompt-dismissed-at'
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000
const SAFE_DASHBOARD_PATHS = new Set([
  '/dashboard/student',
  '/dashboard/student/classes',
  '/dashboard/student/assignments',
  '/dashboard/student/mocks',
  '/dashboard/student/materials',
  '/dashboard/student/progress',
])

export function BrowserPushPrompt() {
  const pathname = usePathname()
  const [token, setToken] = useState('')
  const [state, setState] = useState<BrowserPushState>('loading')
  const [visible, setVisible] = useState(false)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (!SAFE_DASHBOARD_PATHS.has(pathname) || !isBrowserPushEligible()) return active && setVisible(false)
      if (Date.now() - Number(localStorage.getItem(DISMISSED_KEY) || 0) < DISMISS_MS) return active && setVisible(false)
      const nextToken = await getCurrentAccessToken(createClient())
      if (!nextToken) return active && setVisible(false)
      const nextState = await getBrowserPushState(nextToken)
      if (!active) return
      setToken(nextToken)
      setState(nextState)
      setVisible(nextState === 'disabled')
    }
    void refresh().catch(() => { if (active) setVisible(false) })
    window.addEventListener(BROWSER_PUSH_ELIGIBLE_EVENT, refresh)
    return () => {
      active = false
      window.removeEventListener(BROWSER_PUSH_ELIGIBLE_EVENT, refresh)
    }
  }, [pathname])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setVisible(false)
  }

  async function enable() {
    setWorking(true)
    try {
      await enableBrowserPush(token)
      toast.success('Class and deadline reminders are enabled on this device.')
      setState('enabled')
      setVisible(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not enable browser notifications')
      setState(await getBrowserPushState(token).catch((): BrowserPushState => 'unavailable'))
      setVisible(false)
    } finally {
      setWorking(false)
    }
  }

  if (!visible || state !== 'disabled') return null
  return <aside aria-label="Enable class reminders" className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-2xl border border-[#d8d2cd] bg-white p-4 shadow-2xl sm:bottom-5 sm:flex sm:items-center sm:gap-4">
    <button type="button" onClick={dismiss} aria-label="Dismiss reminder suggestion" className="absolute right-2 top-2 rounded-lg p-2 text-[#716c76] hover:bg-[#f4f1ef]"><X size={17} /></button>
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2e2877] text-white"><Bell size={20} /></div>
    <div className="mt-3 min-w-0 flex-1 pr-7 sm:mt-0 sm:pr-0"><p className="font-semibold text-[#25232d]">Never miss a class or deadline</p><p className="mt-1 text-sm leading-5 text-[#716c76]">Turn on reminders for live classes, assignments, mock results, and updates.</p></div>
    <button type="button" disabled={working} onClick={() => void enable()} className="mt-3 min-h-11 rounded-xl bg-[#2e2877] px-5 text-sm font-semibold text-white disabled:opacity-50 sm:mt-0">{working ? 'Enabling…' : 'Enable reminders'}</button>
  </aside>
}
