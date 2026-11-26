import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AccountSwitcher } from './account-switcher'
import { clearActiveAccountId, getActiveAccountId, setActiveAccountId } from '@/lib/account-preference'

const mocks = vi.hoisted(() => ({
  authenticatedApiFetch: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedApiFetch: mocks.authenticatedApiFetch }))
vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard', useRouter: () => ({ replace: mocks.replace }) }))

const firstAccount = { id: 'membership-1', school_id: '11111111-1111-4111-8111-111111111111', role: 'admin', joined_at: '2026-01-01T00:00:00.000Z', school: { id: '11111111-1111-4111-8111-111111111111', name: 'First Account' }, active: true }
const secondAccount = { id: 'membership-2', school_id: '22222222-2222-4222-8222-222222222222', role: 'tutor', joined_at: '2026-01-02T00:00:00.000Z', school: { id: '22222222-2222-4222-8222-222222222222', name: 'Second Account' }, active: false }

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

function renderSwitcher(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return { queryClient, ...render(<QueryClientProvider client={queryClient}><AccountSwitcher /></QueryClientProvider>) }
}

describe('AccountSwitcher', () => {
  beforeEach(() => {
    sessionStorage.clear()
    clearActiveAccountId()
    vi.clearAllMocks()
  })

  it('selects the only active membership automatically', async () => {
    mocks.authenticatedApiFetch.mockImplementationOnce(() => response({ data: [secondAccount] }))
    renderSwitcher()

    await waitFor(() => expect(getActiveAccountId()).toBe(secondAccount.school_id))
    expect(await screen.findByText('Second Account')).toBeInTheDocument()
  })

  it('leaves the choice to the person when several memberships exist and nothing is stored', async () => {
    mocks.authenticatedApiFetch.mockImplementationOnce(() => response({ data: [firstAccount, secondAccount] }))
    renderSwitcher()

    expect(await screen.findByText('Choose tutoring account')).toBeInTheDocument()
    await waitFor(() => expect(mocks.authenticatedApiFetch).toHaveBeenCalledOnce())
    expect(getActiveAccountId()).toBeNull()
  })

  it('clears a stored selection that is no longer an active membership', async () => {
    setActiveAccountId('33333333-3333-4333-8333-333333333333')
    mocks.authenticatedApiFetch.mockImplementationOnce(() => response({ data: [firstAccount, secondAccount] }))
    renderSwitcher()

    await waitFor(() => expect(getActiveAccountId()).toBeNull())
  })

  it('lists active accounts and switches without retaining old account cache', async () => {
    mocks.authenticatedApiFetch.mockImplementationOnce(() => response({ data: [firstAccount, secondAccount] }))
      .mockImplementationOnce(() => response({ data: { school_id: secondAccount.school_id } }))
    const { queryClient } = renderSwitcher()
    queryClient.setQueryData(['old-account-data'], { account: firstAccount.school_id })

    fireEvent.click(await screen.findByRole('button', { name: 'Choose tutoring account' }))
    fireEvent.click(await screen.findByRole('option', { name: /Second Account/ }))

    await waitFor(() => expect(getActiveAccountId()).toBe(secondAccount.school_id))
    expect(queryClient.getQueryData(['old-account-data'])).toBeUndefined()
    expect(mocks.authenticatedApiFetch).toHaveBeenCalledWith(expect.stringContaining(`/students/me/centres/${secondAccount.school_id}/select`), expect.objectContaining({ method: 'POST' }))
  })

  it('shows an empty state when no active memberships are available', async () => {
    mocks.authenticatedApiFetch.mockImplementationOnce(() => response({ data: [] }))
    renderSwitcher()

    fireEvent.click(await screen.findByRole('button', { name: 'Choose tutoring account' }))

    expect(await screen.findByText('No active tutoring accounts are available yet.')).toBeInTheDocument()
  })

  it('maps account lookup failures to safe retryable copy', async () => {
    mocks.authenticatedApiFetch.mockImplementationOnce(() => response({ error: 'secret database detail', code: 'CENTRES_UNAVAILABLE' }, 500))
    renderSwitcher()

    fireEvent.click(await screen.findByRole('button', { name: 'Choose tutoring account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not verify your tutoring accounts. Try again.')
    expect(screen.queryByText('secret database detail')).not.toBeInTheDocument()
  })

  it('keeps the current preference when the selected account is revoked', async () => {
    setActiveAccountId(firstAccount.school_id)
    mocks.authenticatedApiFetch.mockImplementationOnce(() => response({ data: [firstAccount, secondAccount] }))
      .mockImplementationOnce(() => response({ error: 'membership detail', code: 'FORBIDDEN' }, 403))
    renderSwitcher()

    fireEvent.click(await screen.findByRole('button', { name: 'Choose tutoring account' }))
    fireEvent.click(await screen.findByRole('option', { name: /Second Account/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That tutoring account is no longer available.')
    expect(getActiveAccountId()).toBe(firstAccount.school_id)
  })
})
