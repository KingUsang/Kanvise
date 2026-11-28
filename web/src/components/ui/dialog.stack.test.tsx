import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Dialog, isTopDialog, pushDialog, removeDialog } from './dialog'

describe('dialog stack', () => {
  it('tracks the top dialog', () => {
    const a = Symbol('a')
    const b = Symbol('b')
    pushDialog(a)
    pushDialog(b)
    expect(isTopDialog(b)).toBe(true)
    expect(isTopDialog(a)).toBe(false)
    removeDialog(b)
    expect(isTopDialog(a)).toBe(true)
    removeDialog(a)
  })

  it('closes only the top dialog on Escape', () => {
    const closeBottom = vi.fn()
    const closeTop = vi.fn()
    render(
      <>
        <Dialog label="Bottom" onClose={closeBottom}><button>one</button></Dialog>
        <Dialog label="Top" onClose={closeTop}><button>two</button></Dialog>
      </>,
    )
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(closeTop).toHaveBeenCalledTimes(1)
    expect(closeBottom).not.toHaveBeenCalled()
  })

  it('restores focus to the opener on close', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = render(<Dialog label="D"><button>inside</button></Dialog>)
    expect(screen.getByText('inside')).toHaveFocus()
    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('makes the rest of the page inert while open and restores it on close', () => {
    const page = document.createElement('main')
    document.body.appendChild(page)
    const { unmount } = render(<Dialog label="Modal"><button>inside</button></Dialog>)
    expect(page).toHaveAttribute('inert')
    expect(screen.getByRole('dialog').closest('[inert]')).toBeNull()
    unmount()
    expect(page).not.toHaveAttribute('inert')
    page.remove()
  })
})

describe('stacked dialogs show one scrim and keep data', () => {
  it('hides the covered dialog, keeps its input value, and returns on close', () => {
    function Demo({ top }: { top: boolean }) {
      return (
        <>
          <Dialog label="Wizard"><input aria-label="Name" defaultValue="" /></Dialog>
          {top ? <Dialog label="Nested"><button>nested</button></Dialog> : null}
        </>
      )
    }
    const { rerender } = render(<Demo top={false} />)
    const input = screen.getByLabelText('Name') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Ada' } })
    rerender(<Demo top />)
    const wizardRoot = screen.getByLabelText('Wizard').parentElement as HTMLElement
    expect(wizardRoot).toHaveAttribute('data-covered')
    expect(screen.getByLabelText('Nested').parentElement).not.toHaveAttribute('data-covered')
    expect(document.querySelectorAll('[data-covered]')).toHaveLength(1)
    rerender(<Demo top={false} />)
    expect(wizardRoot).not.toHaveAttribute('data-covered')
    expect(wizardRoot).not.toHaveAttribute('inert')
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Ada')
  })
})
