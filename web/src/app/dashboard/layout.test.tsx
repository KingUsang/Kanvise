import { isValidElement, Suspense, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/dashboard/signed-in-layout', () => ({ SignedInDashboardLayout: () => null }))

import DashboardLayout from './layout'
import { ShellFirstPaintSkeleton } from '@/components/shell/first-paint-skeleton'

describe('DashboardLayout first paint (16 R-08)', () => {
  it('streams the shell skeleton while the sign-in check runs', () => {
    const tree = DashboardLayout({ children: null }) as ReactElement<{ fallback: ReactElement }>
    expect(tree.type).toBe(Suspense)
    expect(isValidElement(tree.props.fallback)).toBe(true)
    expect(tree.props.fallback.type).toBe(ShellFirstPaintSkeleton)
  })
})
