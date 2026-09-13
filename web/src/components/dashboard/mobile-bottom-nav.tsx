'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getDashboardWorkspaces, getDashboardWorkspaceForPath, type DashboardCapabilities } from '@/config/dashboard-navigation'

export function MobileBottomNav({ capabilities }: { capabilities: DashboardCapabilities }) {
  const pathname = usePathname()
  const items = getDashboardWorkspaces(capabilities)
  const activeArea = getDashboardWorkspaceForPath(pathname)

  return (
    <nav aria-label="Dashboard navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ded9d4] bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(35,31,38,0.06)] backdrop-blur md:hidden">
      <div className={`mx-auto grid max-w-lg ${items.length === 5 ? 'grid-cols-5' : items.length === 1 ? 'grid-cols-1' : 'grid-cols-4'}`}>
      {items.map((item) => {
        const isActive = activeArea === item.area
        return (
          <Link key={item.href} href={item.href} aria-current={isActive ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium ${isActive ? 'bg-[#eeeafe] text-[#2e2877]' : 'text-[#716c76]'}`}>
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        )
      })}
      </div>
    </nav>
  )
}
