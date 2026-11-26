import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog } from './dialog'

function Harness({ busy = false }: { busy?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Test dialog"
        description="Dialog description"
        busy={busy}
      >
        <input data-dialog-initial-focus aria-label="Name" />
        <button type="button">Second action</button>
      </Dialog>
    </>
  )
}

describe('Dialog', () => {
  afterEach(() => {
    cleanup()
    document.body.style.overflow = ''
  })

  it('announces its content, focuses the requested control, and restores focus on close', async () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    trigger.focus()

    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Test dialog' })
    expect(dialog).toHaveAccessibleDescription('Dialog description')
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('keeps keyboard focus inside the dialog', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }))
    const dialog = await screen.findByRole('dialog')
    const close = screen.getByRole('button', { name: 'Close dialog' })
    const second = screen.getByRole('button', { name: 'Second action' })

    second.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(close).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(second).toHaveFocus()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('prevents dismissal and locks body scroll while busy', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Busy dialog" description="Please wait" busy>
        <button type="button">Action</button>
      </Dialog>,
    )
    const dialog = await screen.findByRole('dialog', { name: 'Busy dialog' })
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.mouseDown(dialog)
    expect(onClose).not.toHaveBeenCalled()
  })
})
