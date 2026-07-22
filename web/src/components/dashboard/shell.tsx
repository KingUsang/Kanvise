'use client'

import React, { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
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
    <div className="min-h-screen bg-[#f5f3f2] font-sans relative">
      <Sidebar 
        capabilities={capabilities} 
        isMobileOpen={isMobileMenuOpen} 
        onCloseMobile={() => setIsMobileMenuOpen(false)} 
      />
      <TopBar 
        user={user} 
        capabilities={capabilities}
        onMenuClick={() => setIsMobileMenuOpen(true)} 
      />
      
      {/* Main Content Area */}
      <main className="md:ml-64 pt-16 min-h-screen flex flex-col">
        <div className="p-4 md:p-8 w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}
