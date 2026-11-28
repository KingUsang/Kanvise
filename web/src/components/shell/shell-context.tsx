'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import type { DashboardCapabilities } from '@/config/dashboard-navigation'

export type ShellChrome = {
  capabilities: DashboardCapabilities
  /**
   * Hides the phone bottom bar while a full-screen flow (wizard, editor,
   * classroom) needs the screen (R-02). Returns a function that shows it again.
   */
  hideBottomBar: () => () => void
}

const ShellContext = createContext<ShellChrome | null>(null)

export function ShellChromeProvider({ value, children }: { value: ShellChrome; children: ReactNode }) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

/** Shell controls for pages. Outside the shell (tests, previews) it does nothing. */
export function useShellChrome(): ShellChrome | null {
  return useContext(ShellContext)
}

/** Hides the phone bottom bar while the calling component is mounted and `active`. */
export function useHiddenBottomBar(active = true) {
  const shell = useShellChrome()
  useEffect(() => {
    if (!active || !shell) return
    return shell.hideBottomBar()
  }, [active, shell])
}
