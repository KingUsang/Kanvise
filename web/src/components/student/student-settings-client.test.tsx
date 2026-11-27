import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StudentSettingsClient } from './student-settings-client'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.test' }))
vi.mock('@/components/pwa/browser-push-settings', () => ({ BrowserPushSettings: () => null }))
const { authenticatedFetch } = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }))
vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedFetch }))

function renderClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><StudentSettingsClient /></QueryClientProvider>)
}

describe('StudentSettingsClient', () => {
  it('fills the profile form from the fetched settings', async () => {
    authenticatedFetch.mockResolvedValue(new Response(JSON.stringify({ data: { profile: { id: 'p1', kanvise_user_id: 'u1', first_name: 'Ada', last_name: 'Obi', email: 'a@b.c', bio: 'Hi', profile_photo_url: null } } }), { status: 200 }))
    renderClient()
    await waitFor(() => expect(screen.getByDisplayValue('Ada')).toBeInTheDocument())
    expect(screen.getByDisplayValue('Obi')).toBeInTheDocument()
  })

  it('shows a retryable safe error when settings fail to load', async () => {
    authenticatedFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'sql boom' }), { status: 500 }))
    renderClient()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your settings.')
    expect(screen.queryByText(/sql boom/)).not.toBeInTheDocument()
  })
})
