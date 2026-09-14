'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getDashboardNavItems, type DashboardCapabilities } from '@/config/dashboard-navigation'
import { startNavigationProgress } from '@/components/navigation/NavigationProgress'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { detachBrowserPushOnLogout } from '@/lib/push-notifications'

interface TopBarProps {
  user: {
    first_name: string;
    last_name: string;
    role: string;
  };
  capabilities: DashboardCapabilities;
  onMenuClick?: () => void;
}

export function TopBar({ user, capabilities, onMenuClick }: TopBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const searchableItems = useMemo(() => getDashboardNavItems(capabilities), [capabilities])
  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return searchableItems
    return searchableItems.filter((item) =>
      [item.label, ...item.keywords].some((value) => value.toLowerCase().includes(normalizedQuery))
    )
  }, [query, searchableItems])

  const navigateTo = (href: string) => {
    if (capabilities.setupRequired && href !== '/dashboard/school-setup') {
      setIsSearchOpen(false)
      toast.info('Create your centre first', {
        description: 'This page will unlock as soon as you complete the required setup.',
      })
      return
    }
    setQuery('')
    setIsSearchOpen(false)
    startNavigationProgress()
    router.push(href)
  }

  const signOut = async () => {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      await detachBrowserPushOnLogout(sessionData.session?.access_token)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      window.location.href = '/auth/login'
    } catch {
      setIsSigningOut(false)
      toast.error('Could not log out. Please try again.')
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-[#c8c5d2] bg-white/95 px-4 backdrop-blur-sm md:left-[280px] md:px-10">
      
      {/* Search & Mobile Menu */}
      <div className="flex flex-1 items-center gap-4 md:max-w-md">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-bold tracking-tight text-[#180d62] sm:hidden" aria-label="Kanvise dashboard">
          <img src="/kanvise_logo.jpeg" alt="" className="size-6 rounded border border-[#c8c5d2] object-cover" />
          <span>Kanvise</span>
        </Link>
        {onMenuClick && <button
          className="md:hidden text-[#474551] flex items-center"
          onClick={onMenuClick}
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>}
        <div className="relative flex-1 hidden sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#474551] text-[20px]">
            search
          </span>
          <input 
            type="text" 
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setIsSearchOpen(false), 120)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsSearchOpen(false)
              if (event.key === 'Enter' && results[0]) navigateTo(results[0].href)
            }}
            placeholder="Search dashboard pages..."
            aria-label="Search dashboard pages"
            aria-expanded={isSearchOpen}
            aria-controls="dashboard-search-results"
            className="w-full bg-[#f5f3f2] border border-[#c8c5d2] rounded-lg py-2 pl-10 pr-4 text-sm text-[#1b1c1c] focus:outline-none focus:ring-2 focus:ring-[#2e2877]"
          />
          {isSearchOpen && (
            <div id="dashboard-search-results" className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-lg border border-[#c8c5d2] bg-white shadow-[0_12px_32px_rgba(46,40,119,0.16)]">
              {results.length > 0 ? results.slice(0, 7).map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => navigateTo(item.href)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#1b1c1c] hover:bg-[#f5f3f2] focus:bg-[#f5f3f2] focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px] text-[#2e2877]">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )) : (
                <p className="px-4 py-4 text-sm text-[#474551]">No dashboard page matches “{query}”.</p>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* User identity */}
      <div className="flex items-center space-x-3 sm:space-x-6">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((open) => !open)}
            onBlur={() => window.setTimeout(() => setIsUserMenuOpen(false), 120)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsUserMenuOpen(false)
            }}
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            aria-controls="dashboard-user-menu"
            className="flex items-center space-x-3 rounded-lg px-2 py-1 hover:bg-[#f5f3f2] focus:outline-none focus:ring-2 focus:ring-[#2e2877]"
          >
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-[#1b1c1c]">
                {user.first_name}
              </div>
              <div className="text-xs text-[#474551] capitalize">{user.role}</div>
            </div>

            <div className="w-10 h-10 rounded-full bg-[#180d62] text-white flex items-center justify-center font-bold">
              {user.first_name?.[0]}
            </div>
          </button>

          {isUserMenuOpen && (
            <div
              id="dashboard-user-menu"
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] w-44 overflow-hidden rounded-lg border border-[#c8c5d2] bg-white shadow-[0_12px_32px_rgba(46,40,119,0.16)]"
            >
              <button
                type="button"
                role="menuitem"
                disabled={isSigningOut}
                onMouseDown={(event) => event.preventDefault()}
                onClick={signOut}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#1b1c1c] hover:bg-[#f5f3f2] focus:bg-[#f5f3f2] focus:outline-none disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px] text-[#2e2877]">logout</span>
                <span>{isSigningOut ? 'Logging out…' : 'Log out'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
