import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionDetailClient } from './session-detail-client'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedApiFetch: fetchMock }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const session = { id: 's1', title: 'Algebra', scheduled_at: '2026-05-01T10:00:00.000Z', duration_minutes: 60, status: 'scheduled' }

function renderDetail(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(<QueryClientProvider client={client}><SessionDetailClient sessionId="s1" /></QueryClientProvider>)
  return client
}

beforeEach(() => fetchMock.mockReset())

describe('SessionDetailClient recovery (DEV-FE-043)', () => {
  it('retries a failed initial Session load in place', async () => {
    let fail = true
    fetchMock.mockImplementation(async () => fail ? json({ error: 'boom' }, 500) : json({ data: session }))
    renderDetail()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/Algebra/)).toBeInTheDocument()
  })

  it('keeps loaded attendance rows and offers retry when a refresh fails', async () => {
    const row = { student_id: 'l1', student_name: 'Ada Learner', join_time: '10:01', duration: '50m', status: 'Present' }
    fetchMock.mockImplementation(async (url: string) => String(url).includes('/attendance/records') ? json({ data: [row] }) : json({ data: session }))
    const client = renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'attendance' }))
    expect(await screen.findByText('Ada Learner')).toBeInTheDocument()
    fetchMock.mockImplementation(async (url: string) => String(url).includes('/attendance/records') ? json({ error: 'down' }, 503) : json({ data: session }))
    await client.refetchQueries({ queryKey: ['session-attendance', 's1'] })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('could not refresh'))
    expect(screen.getByText('Ada Learner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
