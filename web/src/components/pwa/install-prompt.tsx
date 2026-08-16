'use client'

import { Download, Share2, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISSED_KEY = 'kanvise-install-dismissed-at'
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000
const ENTRY_PATHS = new Set(['/', '/auth/login', '/dashboard', '/dashboard/student'])

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function InstallPrompt() {
  const pathname = usePathname()
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [isIos, setIsIos] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ENTRY_PATHS.has(pathname) || isStandalone()) return
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0)
    if (Date.now() - dismissedAt < DISMISS_MS) return
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const frame = ios ? window.requestAnimationFrame(() => {
      setIsIos(true)
      setVisible(true)
    }) : 0
    const capture = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', capture)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('beforeinstallprompt', capture)
    }
  }, [pathname])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setVisible(false)
  }

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') setVisible(false)
    setInstallEvent(null)
  }

  if (!visible || (!installEvent && !isIos)) return null
  return <aside aria-label="Install Kanvise" className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-2xl border border-[#d8d2cd] bg-white p-4 shadow-2xl sm:bottom-5 sm:flex sm:items-center sm:gap-4">
    <button onClick={dismiss} aria-label="Dismiss install suggestion" className="absolute right-2 top-2 rounded-lg p-2 text-[#716c76] hover:bg-[#f4f1ef]"><X size={17} /></button>
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2e2877] text-white"><Download size={20} /></div>
    <div className="mt-3 min-w-0 flex-1 pr-7 sm:mt-0 sm:pr-0"><p className="font-semibold text-[#25232d]">Install Kanvise</p><p className="mt-1 text-sm leading-5 text-[#716c76]">{isIos ? 'Open Share, then choose “Add to Home Screen”.' : 'Open Kanvise like an app from your home screen or desktop.'}</p></div>
    {isIos ? <span className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#f0edff] px-4 py-2.5 text-sm font-semibold text-[#2e2877] sm:mt-0"><Share2 size={17} />Share</span>
      : <button onClick={() => void install()} className="mt-3 min-h-11 rounded-xl bg-[#2e2877] px-5 text-sm font-semibold text-white sm:mt-0">Install</button>}
  </aside>
}
