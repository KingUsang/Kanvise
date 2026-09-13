'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { MobileBottomNav } from './mobile-bottom-nav'
import { canAccessDashboardPath, type DashboardCapabilities } from '@/config/dashboard-navigation'

interface DashboardShellProps {
  children: React.ReactNode;
  user: {
    first_name: string;
    last_name: string;
    role: string;
  };
  capabilities: DashboardCapabilities;
}

export function DashboardShell({ children, user, capabilities }: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const canAccessCurrentPath = canAccessDashboardPath(pathname, capabilities)

  React.useEffect(() => {
    if (!canAccessCurrentPath) router.replace('/dashboard?notice=not-authorised')
  }, [canAccessCurrentPath, router])

  if (!canAccessCurrentPath) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f3f2] font-sans text-[#474551]">
        Redirecting you to an available dashboard…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbf9f8] font-sans relative">
      <Sidebar capabilities={capabilities} />
      <TopBar 
        user={user} 
        capabilities={capabilities}
      />
      <MobileBottomNav capabilities={capabilities} />
      
      {/* Main Content Area */}
      <main className="md:ml-[280px] pt-16 min-h-screen flex flex-col">
        <div className="w-full flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-10">
          {children}
        </div>
      </main>
    </div>
  )
}
