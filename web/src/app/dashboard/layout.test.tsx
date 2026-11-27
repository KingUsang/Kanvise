import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getUser, activeAccountId } = vi.hoisted(() => ({ getUser: vi.fn(), activeAccountId: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser } }) }))
vi.mock('@/lib/server/server-account', () => ({ serverActiveAccountId: activeAccountId }))
vi.mock('@/components/dashboard/shell', () => ({ DashboardShell: (props: { setupRequired?: boolean }) => props }))

import DashboardLayout from './layout'

const admin = (appMetadata: Record<string, unknown> = {}) => ({ data: { user: { app_metadata: { kanvise_role: 'admin', ...appMetadata }, user_metadata: {} } } })
async function setupRequired() {
  const tree = await DashboardLayout({ children: null }) as { props: { children: { props: { setupRequired?: boolean } } } }
  return Boolean(tree.props.children.props.setupRequired)
}

describe('DashboardLayout account detection', () => {
  beforeEach(() => { vi.clearAllMocks(); activeAccountId.mockResolvedValue(null) })

  it('treats an Admin with a selected account as set up even without the claim', async () => {
    getUser.mockResolvedValue(admin())
    activeAccountId.mockResolvedValue('11111111-1111-4111-8111-111111111111')
    expect(await setupRequired()).toBe(false)
  })

  it('keeps the claim as a fallback right after account creation', async () => {
    getUser.mockResolvedValue(admin({ school_id: 'school-1' }))
    expect(await setupRequired()).toBe(false)
  })

  it('requires setup for an Admin with neither a selected account nor a claim', async () => {
    getUser.mockResolvedValue(admin())
    expect(await setupRequired()).toBe(true)
  })
})
