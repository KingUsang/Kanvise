import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SubmissionsClient } from './submissions-client'

const { authenticatedApiFetch } = vi.hoisted(() => ({
  authenticatedApiFetch: vi.fn(),
}))

vi.mock('@/lib/authenticated-fetch', () => ({
  authenticatedApiFetch,
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

describe('SubmissionsClient token boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticatedApiFetch.mockResolvedValue(new Response(JSON.stringify({ data: [], summary: {} })))
  })

  it('loads submissions through the shared browser-session client without a session prop', async () => {
    render(<SubmissionsClient assignmentId="assignment-1" />)

    await waitFor(() => expect(authenticatedApiFetch).toHaveBeenCalledTimes(1))

    expect(authenticatedApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/assignments/assignment-1/submissions'),
    )
    expect(authenticatedApiFetch.mock.calls[0]?.[1]).toBeUndefined()
  })
})
