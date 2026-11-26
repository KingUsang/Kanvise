import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotesClient } from './notes-client'

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

  it('shows a safe session-ended message when upload presigning has no response body', async () => {
    authenticatedApiFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'course-1', name: 'Math', programme: null }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))

    const { container } = render(<NotesClient role="tutor" profileId="profile-1" />)
    await waitFor(() => expect(authenticatedApiFetch).toHaveBeenCalledTimes(2))

    fireEvent.change(container.querySelector('select')!, { target: { value: 'course-1' } })
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['lesson'], 'lesson.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Share material' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Your session has ended. Please sign in again.'))
  })

  it('shows a safe session-ended message when deleting has no response body', async () => {
    authenticatedApiFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'course-1', name: 'Math', programme: null }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{
        id: 'note-1',
        title: 'Lesson',
        description: null,
        file_name: 'lesson.pdf',
        file_type: 'application/pdf',
        file_size_bytes: 10,
        created_at: '2026-11-03T00:00:00.000Z',
        course_id: 'course-1',
        download_url: 'https://example.test/lesson.pdf',
        tutor_id: 'profile-1',
      }] })))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))

    render(<NotesClient role="tutor" profileId="profile-1" />)
    await waitFor(() => expect(authenticatedApiFetch).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByTitle('Delete'))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove material' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Your session has ended. Please sign in again.'))
  })
})
