'use client'

import React from 'react'
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
  return (
    <div className="min-h-screen bg-[#f5f3f2] font-sans">
      <Sidebar capabilities={capabilities} />
      <TopBar user={user} />
      
      {/* Main Content Area */}
      <main className="ml-64 pt-16 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
