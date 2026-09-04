'use client'

import { Bell, BellOff, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { disableBrowserPush, enableBrowserPush, getBrowserPushState, type BrowserPushState } from '@/lib/push-notifications'

const descriptions: Record<BrowserPushState, string> = {
  loading: 'Checking this device…',
  unsupported: 'This browser does not support Web Push. On iPhone and iPad, install Kanvise to the Home Screen first.',
  blocked: 'Notifications are blocked. Allow them in your browser or device settings, then return here.',
  disabled: 'Get class reminders, deadlines, new mocks, cancellations, and grading updates on this device.',
  enabled: 'This device will receive Kanvise updates even when the app is closed.',
  unavailable: 'Browser notifications are temporarily unavailable.',
}

export function BrowserPushSettings({ token }: { token: string }) {
  const [state, setState] = useState<BrowserPushState>('loading')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    void getBrowserPushState(token).then(setState).catch(() => setState('unavailable'))
  }, [token])

  async function toggle() {
    setWorking(true)
    try {
      if (state === 'enabled') {
        await disableBrowserPush(token)
        setState('disabled')
        toast.success('Browser notifications disabled on this device.')
      } else {
        await enableBrowserPush(token)
        setState('enabled')
        toast.success('Browser notifications enabled on this device.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update browser notifications')
      setState(await getBrowserPushState(token).catch((): BrowserPushState => 'unavailable'))
    } finally { setWorking(false) }
  }

  const actionable = state === 'enabled' || state === 'disabled'
  return <section className="mt-6 rounded-2xl border border-[#e3ded9] bg-white p-5 sm:p-7">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-[#f0edff] p-2.5 text-[#2e2877]">{state === 'enabled' ? <Bell size={20} /> : <BellOff size={20} />}</span><div><h2 className="font-semibold">Browser notifications</h2><p className="mt-1 text-sm leading-6 text-[#716c76]">{descriptions[state]}</p></div></div>
    {actionable && <button disabled={working} onClick={() => void toggle()} className={`mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50 ${state === 'enabled' ? 'border border-[#d9d3cf] text-[#2e2877]' : 'bg-[#2e2877] text-white'}`}>{working ? <Loader2 className="animate-spin" size={17} /> : state === 'enabled' ? <BellOff size={17} /> : <Bell size={17} />}{state === 'enabled' ? 'Disable on this device' : 'Enable browser notifications'}</button>}
  </section>
}
