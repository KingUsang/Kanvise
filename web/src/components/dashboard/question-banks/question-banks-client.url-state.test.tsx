import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QuestionBanksClient } from './question-banks-client'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }))
vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedApiFetch: fetchMock }))
vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('katex', () => ({ default: { renderToString: () => '' } }))
vi.mock('katex/contrib/mhchem', () => ({}))

const bank = (id: string, name: string) => ({
  id, name, description: null, visibility: 'centre', question_count: 0,
  can_edit: false, can_contribute: true, created_at: '2026-01-01', updated_at: '2026-01-01', archived_at: null,
})
const ok = (data: unknown) => ({ ok: true, json: async () => ({ data }) })

function renderClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><QuestionBanksClient /></QueryClientProvider>)
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string) => String(url).includes('/questions') ? ok([]) : String(url).includes('/courses') ? ok([]) : ok([bank('b1', 'Physics'), bank('b2', 'Chemistry')]))
  window.history.replaceState({}, '', '/dashboard/question-banks')
})
afterEach(() => window.history.replaceState({}, '', '/'))

describe('Question bank URL state (DEV-FE-019)', () => {
  it('opens the bank and search named in the URL', async () => {
    window.history.replaceState({}, '', '/dashboard/question-banks?bank=b2&q=force')
    renderClient()
    expect(await screen.findByRole('heading', { name: 'Chemistry' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search question wording…')).toHaveValue('force')
  })

  it('writes the selected bank and search to the URL and restores them on back navigation', async () => {
    renderClient()
    expect(await screen.findByRole('heading', { name: 'Physics' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Chemistry/ }))
    expect(new URL(window.location.href).searchParams.get('bank')).toBe('b2')
    fireEvent.change(screen.getByPlaceholderText('Search question wording…'), { target: { value: 'atoms' } })
    expect(new URL(window.location.href).searchParams.get('q')).toBe('atoms')
    act(() => {
      window.history.replaceState({}, '', '/dashboard/question-banks?bank=b1')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Physics' })).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Search question wording…')).toHaveValue('')
  })
})
