'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getDashboardWorkspaces, getDashboardWorkspaceForPath, type DashboardCapabilities } from '@/config/dashboard-navigation'

export function MobileBottomNav({ capabilities }: { capabilities: DashboardCapabilities }) {
  const pathname = usePathname()
  const items = getDashboardWorkspaces(capabilities)
  const activeArea = getDashboardWorkspaceForPath(pathname)

  return (
    <nav aria-label="Dashboard navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#45408c] bg-[#2e2877] px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(24,13,98,0.18)] md:hidden">
      <div className={`mx-auto grid max-w-lg ${items.length === 5 ? 'grid-cols-5' : items.length === 1 ? 'grid-cols-1' : 'grid-cols-4'}`}>
      {items.map((item) => {
        const isActive = activeArea === item.area
        return (
          <Link key={item.href} href={item.href} aria-current={isActive ? 'page' : undefined} className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold transition-colors ${isActive ? 'text-white' : 'text-[#c8c5ef] hover:text-white'}`}>
            <span className="material-symbols-outlined text-[21px]">{item.icon}</span>
            <span className="max-w-full truncate">{item.label}</span>
            {isActive && <span aria-hidden="true" className="absolute -bottom-1 h-1 w-1 rounded-full bg-[#ff9653]" />}
          </Link>
        )
      })}
      </div>
    </nav>
  )
}
