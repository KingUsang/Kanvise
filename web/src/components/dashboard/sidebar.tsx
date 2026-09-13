'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'

import { useState, useEffect } from 'react'
import { getDashboardNavItems, getDashboardWorkspaceForPath, getDashboardWorkspaces, type DashboardCapabilities } from '@/config/dashboard-navigation'

interface SidebarProps {
  capabilities: DashboardCapabilities;
}

export function Sidebar({ capabilities }: SidebarProps) {
  const pathname = usePathname()
  const [ungradedMocksCount, setUngradedMocksCount] = useState(0)

  useEffect(() => {
    if (capabilities.setupRequired) return
    async function fetchBadgeCount() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const baseUrl = process.env.NEXT_PUBLIC_API_URL
        const res = await fetch(`${baseUrl}/mocks/ungraded-count`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        if (res.ok) {
          const json = await res.json()
          setUngradedMocksCount(json.data?.count || 0)
        }
      } catch (err) {
        console.error('Failed to fetch badge count', err)
      }
    }
    fetchBadgeCount()
  }, [capabilities.setupRequired])
  
  const navItems = getDashboardNavItems(capabilities)
  const workspaces = getDashboardWorkspaces(capabilities)
  const activeWorkspace = getDashboardWorkspaceForPath(pathname)

  return (
    <>
      <aside 
        className="fixed left-0 top-0 z-50 hidden h-screen w-[280px] flex-col bg-[#2e2877] text-white md:flex"
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 shrink-0">
          <div className="flex items-center">
            <img src="/kanvise_logo.jpeg" alt="Kanvise" className="w-8 h-8 rounded border border-white/20 mr-3 object-cover" />
            <h1 className="font-bold text-lg tracking-tight">Kanvise</h1>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 no-scrollbar">
        <ul className="space-y-4">
          {workspaces.map((workspace) => {
            const isWorkspaceActive = activeWorkspace === workspace.area
            const children = navItems.filter((item) => item.area === workspace.area && item.href !== workspace.href)
            const workspaceLocked = capabilities.setupRequired && workspace.href !== '/dashboard/school-setup'
            return <li key={workspace.href}>
              <Link
                href={workspaceLocked ? '/dashboard/school-setup' : workspace.href}
                aria-disabled={workspaceLocked}
                onClick={(event) => {
                  if (workspaceLocked) {
                    event.preventDefault()
                    toast.info('Create your centre first', { description: `${workspace.label} will unlock as soon as you complete the required setup.` })
                    return
                  }
                }}
                className={`flex items-center px-6 py-2.5 text-sm font-semibold transition-colors relative ${workspaceLocked ? 'cursor-not-allowed text-[#7772bd]' : isWorkspaceActive ? 'text-white bg-white/5' : 'text-[#d1ceff] hover:text-white hover:bg-white/5'}`}
              >
                {isWorkspaceActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#c26627] rounded-r-sm" />}
                <span className="material-symbols-outlined mr-3 text-[22px]">{workspace.icon}</span>
                <span>{workspace.label}</span>
              </Link>
              {children.length > 0 && <ul className="mt-1 space-y-0.5">
                {children.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))
            const badge = item.badge === 'ungradedMocks' ? ungradedMocksCount : 0
            const isLocked = capabilities.setupRequired && item.href !== '/dashboard/school-setup'
            return (
              <li key={item.href}>
                <Link
                  href={isLocked ? '/dashboard/school-setup' : item.href}
                  aria-disabled={isLocked}
                  onClick={(event) => {
                    if (isLocked) {
                      event.preventDefault()
                      toast.info('Create your centre first', {
                        description: `${item.label} will unlock as soon as you complete the required setup.`,
                      })
                      return
                    }
                  }}
                  className={`
                    flex items-center py-2 pl-14 pr-5 text-xs font-medium transition-colors relative
                    ${isLocked
                      ? 'cursor-not-allowed text-[#7772bd]'
                      : isActive
                      ? 'text-white bg-white/5' 
                      : 'text-[#9893e8] hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#c26627] rounded-r-sm" />
                  )}
                  <span className="flex-1">{item.label}</span>
                  {isLocked && (
                    <span className="material-symbols-outlined text-[17px]" title="Complete school setup to unlock">lock</span>
                  )}
                  {badge > 0 ? (
                    <span className="bg-[#ba1a1a] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ml-2">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
                })}
              </ul>}
            </li>
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-[#9893e8] text-center">
          Kanvise OS v1.0
        </div>
      </div>
    </aside>
    </>
  )
}
