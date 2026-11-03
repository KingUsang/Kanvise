import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotesClient } from './notes-client'

const { authenticatedApiFetch } = vi.hoisted(() => ({
  authenticatedApiFetch: vi.fn(),
}))

vi.mock('@/lib/authenticated-fetch', () => ({
  authenticatedApiFetch,
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

describe('NotesClient token boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticatedApiFetch.mockResolvedValue(new Response(JSON.stringify({ data: [] })))
  })

  it('receives safe metadata and loads courses through the shared browser-session client', async () => {
    render(<NotesClient role="tutor" profileId="profile-1" />)

    await waitFor(() => expect(authenticatedApiFetch).toHaveBeenCalledTimes(1))

    expect(authenticatedApiFetch).toHaveBeenCalledWith(expect.stringContaining('/courses'))
    expect(authenticatedApiFetch.mock.calls[0]?.[1]).toBeUndefined()
  })
})
