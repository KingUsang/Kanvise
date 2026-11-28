'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Plus } from 'lucide-react'

let mountedFabs = 0

/**
 * Round + button at the bottom right on phone list pages (R-03, R-10). It
 * sits just above the bottom bar (--shell-bar-offset) and is hidden from
 * 768px, where the page header shows the same action. While mounted it adds
 * its height to --shell-bottom-offset so toasts sit above it. A page with a
 * fixed action bar does not use it.
 */
export function Fab({ label, href, onClick }: { label: string; href?: string; onClick?: () => void }) {
  useEffect(() => {
    const root = document.documentElement
    mountedFabs += 1
    root.dataset.shellFab = ''
    return () => {
      mountedFabs -= 1
      if (mountedFabs <= 0) {
        mountedFabs = 0
        delete root.dataset.shellFab
      }
    }
  }, [])
  const className = 'dashboard-press fixed right-4 z-40 inline-flex size-14 items-center justify-center rounded-full bg-dashboard-primary text-white shadow-dashboard-overlay outline-none hover:bg-dashboard-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-focus md:hidden bottom-[calc(var(--shell-bar-offset)+1rem+env(safe-area-inset-bottom))]'
  const icon = <Plus aria-hidden="true" className="size-6" />
  if (href) return <Link href={href} aria-label={label} className={className}>{icon}</Link>
  return <button type="button" aria-label={label} onClick={onClick} className={className}>{icon}</button>
}
