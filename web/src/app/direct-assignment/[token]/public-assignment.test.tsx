import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DirectAssignmentClient from './public-assignment'

const assignment = { title: 'Essay', description: 'Write', deadline_at: '2030-01-01T00:00:00Z', tutor_name: 'Ada', logo_url: null }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('DirectAssignmentClient lookup', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('offers a retry after a 503 and loads the assignment on success', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ error: 'x', code: 'DIRECT_ASSIGNMENT_LOOKUP_FAILED' }, 503))
      .mockResolvedValueOnce(json({ data: assignment }))
    vi.stubGlobal('fetch', fetchMock)
    render(<DirectAssignmentClient token="t" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Essay' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('offers a retry after a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')))
    render(<DirectAssignmentClient token="t" />)
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('treats an unknown link as terminal with no retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'Assignment link not found' }, 404)))
    render(<DirectAssignmentClient token="t" />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Assignment link not found'))
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
})
