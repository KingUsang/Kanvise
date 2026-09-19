'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getDashboardWorkspaces, getDashboardWorkspaceForPath, type DashboardCapabilities } from '@/config/dashboard-navigation'

export function MobileBottomNav({ capabilities }: { capabilities: DashboardCapabilities }) {
  const pathname = usePathname()
  const items = getDashboardWorkspaces(capabilities)
  const activeArea = getDashboardWorkspaceForPath(pathname)

  return (
    <nav aria-label="Dashboard navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e4e2e1] bg-white px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(35,31,38,0.10)] md:hidden">
      <div className={`mx-auto grid h-14 max-w-lg ${items.length === 5 ? 'grid-cols-5' : items.length === 1 ? 'grid-cols-1' : 'grid-cols-4'}`}>
      {items.map((item) => {
        const isActive = activeArea === item.area
        return (
          <Link key={item.href} href={item.href} aria-current={isActive ? 'page' : undefined} className={`flex h-14 min-w-0 flex-col items-center justify-center gap-0 px-1 text-[10px] font-semibold leading-none transition-colors ${isActive ? 'text-[#2e2877]' : 'text-[#77747e] hover:text-[#2e2877]'}`}>
            <span className={`material-symbols-outlined flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[21px] leading-[1] ${isActive ? 'icon-fill bg-[#eeecfa] text-[#2e2877]' : ''}`}>{item.icon}</span>
            <span className="mt-0.5 h-4 w-full truncate text-center text-[10px] leading-4">{item.label}</span>
          </Link>
        )
      })}
      </div>
    </nav>
  )
}
