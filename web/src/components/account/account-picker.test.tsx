import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AccountPicker } from './account-picker'
import { clearActiveAccountId, getActiveAccountId } from '@/lib/account-preference'

const mocks = vi.hoisted(() => ({ authenticatedApiFetch: vi.fn(), assign: vi.fn() }))

vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedApiFetch: mocks.authenticatedApiFetch }))
vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))
vi.mock('next/navigation', () => ({ usePathname: () => '/account/select', useRouter: () => ({ replace: vi.fn() }) }))

const first = { id: 'm-1', school_id: '11111111-1111-4111-8111-111111111111', role: 'tutor', joined_at: '2026-01-01T00:00:00.000Z', school: { id: '11111111-1111-4111-8111-111111111111', name: 'North Centre' } }
const second = { id: 'm-2', school_id: '22222222-2222-4222-8222-222222222222', role: 'tutor', joined_at: '2026-01-02T00:00:00.000Z', school: { id: '22222222-2222-4222-8222-222222222222', name: 'South Centre' } }

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

function renderPicker() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><AccountPicker returnPath="/dashboard/payments" /></QueryClientProvider>)
}

describe('AccountPicker', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    clearActiveAccountId()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign: mocks.assign } as unknown as Location)
  })

  it('lists every active membership and returns to the page after a choice', async () => {
    mocks.authenticatedApiFetch
      .mockImplementationOnce(() => json({ data: [first, second] }))
      .mockImplementationOnce(() => json({ data: { school_id: second.school_id } }))
    renderPicker()

    fireEvent.click(await screen.findByRole('button', { name: /South Centre/ }))

    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith('/dashboard/payments'))
    expect(getActiveAccountId()).toBe(second.school_id)
    expect(screen.getByRole('button', { name: /North Centre/ })).toBeInTheDocument()
  })

  it('selects a single membership without asking', async () => {
    mocks.authenticatedApiFetch
      .mockImplementationOnce(() => json({ data: [first] }))
      .mockImplementationOnce(() => json({ data: { school_id: first.school_id } }))
    renderPicker()

    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith('/dashboard/payments'))
    expect(getActiveAccountId()).toBe(first.school_id)
  })
})
