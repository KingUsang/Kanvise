import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SubmissionsClient } from './submissions-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { clearActiveAccountId, setActiveAccountId } from '@/lib/account-preference'

const { authenticatedApiFetch, toastError } = vi.hoisted(() => ({
  authenticatedApiFetch: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/lib/authenticated-fetch', () => ({
  authenticatedApiFetch,
}))

vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn() },
}))

describe('SubmissionsClient token boundary', () => {
  function renderSubmissions() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={queryClient}><SubmissionsClient assignmentId="assignment-1" /></QueryClientProvider>)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    clearActiveAccountId()
    authenticatedApiFetch.mockResolvedValue(new Response(JSON.stringify({ data: [], summary: {} })))
  })

  it('loads submissions through the shared browser-session client without a session prop', async () => {
    renderSubmissions()

    await waitFor(() => expect(authenticatedApiFetch).toHaveBeenCalledTimes(1))

    expect(authenticatedApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/assignments/assignment-1/submissions'),
    )
    expect(authenticatedApiFetch.mock.calls[0]?.[1]).toBeUndefined()
  })

  it('shows a safe session-ended message when the submissions read has no response body', async () => {
    authenticatedApiFetch.mockResolvedValueOnce(new Response(null, { status: 401 }))

    renderSubmissions()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Your session has ended. Please sign in again.'))
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('reloads the review list when the active account changes', async () => {
    setActiveAccountId('11111111-1111-4111-8111-111111111111')
    renderSubmissions()

    await waitFor(() => expect(authenticatedApiFetch).toHaveBeenCalledTimes(1))
    setActiveAccountId('22222222-2222-4222-8222-222222222222')

    await waitFor(() => expect(authenticatedApiFetch).toHaveBeenCalledTimes(2))
  })

  it('shows a safe session-ended message when grading has no response body', async () => {
    authenticatedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{
        id: 'submission-1',
        score: null,
        feedback: null,
        reviewed_at: null,
        submitted_at: '2026-11-03T00:00:00.000Z',
        download_url: '',
        file_name: 'submission.pdf',
        student: { first_name: 'Ada', last_name: 'Lovelace' },
      }],
      summary: { total_submitted: 1, total_reviewed: 0 },
    })))

    renderSubmissions()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save grade' })).toBeInTheDocument())

    authenticatedApiFetch.mockResolvedValueOnce(new Response(null, { status: 401 }))
    fireEvent.change(document.querySelector('input[type="number"]')!, { target: { value: '80' } })
    screen.getByRole('button', { name: 'Save grade' }).click()

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Your session has ended. Please sign in again.'))
  })
})
