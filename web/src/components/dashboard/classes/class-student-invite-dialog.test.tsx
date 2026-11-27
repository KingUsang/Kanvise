import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassStudentInviteDialog } from './class-student-invite-dialog'

const mocks = vi.hoisted(() => ({
  authenticatedApiFetch: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/lib/authenticated-fetch', () => ({ authenticatedApiFetch: mocks.authenticatedApiFetch }))
vi.mock('sonner', () => ({ toast: mocks.toast }))

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function renderInvite(overrides: Partial<ComponentProps<typeof ClassStudentInviteDialog>> = {}) {
  const onClose = vi.fn()
  const onInvited = vi.fn()
  render(
    <ClassStudentInviteDialog
      open
      onClose={onClose}
      onInvited={onInvited}
      classId="class-1"
      className="Physics"
      api="https://api.example.test"
      {...overrides}
    />,
  )
  return { onClose, onInvited }
}

describe('ClassStudentInviteDialog', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('exposes labelled fields and inline validation before submission', async () => {
    renderInvite()
    const dialog = await screen.findByRole('dialog', { name: 'Add learner' })
    expect(dialog).toHaveAccessibleDescription('They will receive an email to set up their account.')
    expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveAttribute('type', 'email')
    expect(screen.getByRole('button', { name: 'Send invitation' })).toHaveClass('min-h-11')

    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement)

    expect(await screen.findByText('Fix the highlighted fields before sending the invitation.')).toHaveAttribute('role', 'alert')
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveFocus())
    expect(mocks.authenticatedApiFetch).not.toHaveBeenCalled()
  })

  it('preserves the invitation endpoint, payload, and refresh callback', async () => {
    mocks.authenticatedApiFetch.mockResolvedValue(response({ data: {} }))
    const { onClose, onInvited } = renderInvite()

    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'ada@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))

    await waitFor(() => expect(onInvited).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.authenticatedApiFetch).toHaveBeenCalledWith(
      'https://api.example.test/users/students/import',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: [{ email: 'ada@example.test', programme_id: 'class-1' }],
          send_invitations: true,
        }),
      }),
    )
    expect(mocks.toast.success).toHaveBeenCalledWith('Invitation sent. The learner will join this class after accepting it.')
  })

  it('keeps the dialog open while the invitation is pending', async () => {
    let resolveResponse: (value: Response) => void = () => undefined
    mocks.authenticatedApiFetch.mockReturnValue(new Promise<Response>((resolve) => { resolveResponse = resolve }))
    const { onClose } = renderInvite()
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'ada@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sending invitation…' })).toHaveAttribute('aria-busy', 'true'))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    resolveResponse(response({ data: {} }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})
