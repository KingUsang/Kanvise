'use client'

import React, { useState } from 'react'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

interface DashboardShellProps {
  children: React.ReactNode;
  user: {
    first_name: string;
    last_name: string;
    role: string;
  };
  capabilities: {
    isAdmin: boolean;
    isTutor: boolean;
  };
}

export function DashboardShell({ children, user, capabilities }: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#f5f3f2] font-sans relative">
      <Sidebar 
        capabilities={capabilities} 
        isMobileOpen={isMobileMenuOpen} 
        onCloseMobile={() => setIsMobileMenuOpen(false)} 
      />
      <TopBar 
        user={user} 
        onMenuClick={() => setIsMobileMenuOpen(true)} 
      />
      
      {/* Main Content Area */}
      <main className="md:ml-64 pt-16 min-h-screen flex flex-col">
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}
