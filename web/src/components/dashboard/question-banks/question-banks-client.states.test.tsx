import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuestionBanksClient } from './question-banks-client'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedApiFetch: fetchMock }))
vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('katex', () => ({ default: { renderToString: () => '' } }))
vi.mock('katex/contrib/mhchem', () => ({}))

const bank = (over: Record<string, unknown>) => ({
  id: 'bank-1', name: 'Physics', description: null, visibility: 'centre', question_count: 0,
  can_edit: false, can_contribute: true, created_at: '2026-01-01', updated_at: '2026-01-01', archived_at: null, ...over,
})
const ok = (data: unknown) => ({ ok: true, json: async () => ({ data }) })
const fail = (error: string) => ({ ok: false, json: async () => ({ error }) })

function renderClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><QuestionBanksClient /></QueryClientProvider>)
}

beforeEach(() => fetchMock.mockReset())

describe('Question bank states (DEV-QBK-004, DEV-QBK-005)', () => {
  it('shows an error with retry, not the empty state, when banks fail to load', async () => {
    fetchMock.mockResolvedValue(fail('Database unavailable'))
    renderClient()
    expect(await screen.findByText('Could not load your question banks')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText('No question banks yet')).not.toBeInTheDocument()
  })

  it('shows an error with retry, not "ready for questions", when questions fail to load', async () => {
    fetchMock.mockImplementation(async (url: string) => String(url).includes('/questions') ? fail('Questions unavailable') : String(url).includes("/courses") ? ok([]) : ok([bank({})]))
    renderClient()
    expect(await screen.findByText('Could not load the questions')).toBeInTheDocument()
    expect(screen.queryByText('This bank is ready for questions')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('offers Add question on a shared bank the tutor may contribute to', async () => {
    fetchMock.mockImplementation(async (url: string) => String(url).includes('/questions') ? ok([]) : String(url).includes("/courses") ? ok([]) : ok([bank({})]))
    renderClient()
    expect(await screen.findByRole('button', { name: /Add question/ })).toBeInTheDocument()
  })

  it('hides every add-question action when the bank is not contributable', async () => {
    fetchMock.mockImplementation(async (url: string) => String(url).includes('/questions') ? ok([]) : String(url).includes("/courses") ? ok([]) : ok([bank({ can_contribute: false })]))
    renderClient()
    await waitFor(() => expect(screen.getByText('This bank is ready for questions')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Add question/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add the first question' })).not.toBeInTheDocument()
  })
})
