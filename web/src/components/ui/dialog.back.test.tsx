import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Dialog, ModalDialog, resetBackHandlingForTests } from './dialog'
import { Sheet } from './sheet'

/**
 * jsdom has no session history for these tests, so history.pushState/back are
 * spied on and Back is simulated by firing popstate the way a browser does.
 */
function spyHistory() {
  const push = vi.spyOn(window.history, 'pushState')
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
  return { push, back }
}

const pressBack = () => act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })) })

afterEach(() => {
  cleanup()
  resetBackHandlingForTests()
  vi.restoreAllMocks()
})

describe('phone Back gesture on sheets', () => {
  it('pushes one history entry when a sheet opens and closes it on Back without leaving the page', () => {
    const { push, back } = spyHistory()
    const onClose = vi.fn()
    render(<Sheet open onClose={onClose} title="Filters"><button>inside</button></Sheet>)
    expect(push).toHaveBeenCalledTimes(1)
    pressBack()
    expect(onClose).toHaveBeenCalledTimes(1)
    // The browser already popped the entry, so closing must not pop another one.
    expect(back).not.toHaveBeenCalled()
  })

  it('pops its own entry when closed another way, and ignores that pop', () => {
    const { back } = spyHistory()
    const lower = vi.fn()
    const onClose = vi.fn()
    render(<Sheet open onClose={lower} title="Lower"><button>a</button></Sheet>)
    const { unmount } = render(<Sheet open onClose={onClose} title="Upper"><button>b</button></Sheet>)
    unmount()
    expect(back).toHaveBeenCalledTimes(1)
    pressBack() // the pop caused by closing the upper sheet
    expect(lower).not.toHaveBeenCalled()
    pressBack() // a real Back gesture
    expect(lower).toHaveBeenCalledTimes(1)
  })

  it('does not pop history when the sheet closes because a link was followed', () => {
    const { back } = spyHistory()
    const { unmount } = render(<Sheet open onClose={vi.fn()} title="More"><button>a</button></Sheet>)
    // A nav link tapped inside the sheet pushes the new page on top of the sheet's entry.
    window.history.pushState({}, '', '/elsewhere')
    unmount()
    expect(back).not.toHaveBeenCalled()
    window.history.replaceState({}, '', '/')
  })

  it('does not pop when a link click closes the sheet before the route change commits', () => {
    const { back } = spyHistory()
    function Host() {
      const [open, setOpen] = useState(true)
      return (
        <Sheet open={open} onClose={() => setOpen(false)} title="More">
          <a href="#next" onClick={(e) => { e.preventDefault(); setOpen(false) }}>Next page</a>
        </Sheet>
      )
    }
    render(<Host />)
    fireEvent.click(screen.getByText('Next page'))
    // The sheet is gone but the router has not pushed yet, so the URL and entry are still the sheet's own.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(back).not.toHaveBeenCalled()
    // The deferred route commit lands afterwards.
    window.history.pushState({}, '', '/elsewhere')
    expect(back).not.toHaveBeenCalled()
    window.history.replaceState({}, '', '/')
  })

  it('does not let a pop that never arrives swallow the next real Back', () => {
    vi.useFakeTimers()
    try {
      spyHistory()
      const lower = vi.fn()
      render(<Sheet open onClose={lower} title="Lower"><button>a</button></Sheet>)
      const { unmount } = render(<Sheet open onClose={vi.fn()} title="Upper"><button>b</button></Sheet>)
      unmount() // asks for a pop; the mocked history.back never delivers one
      act(() => { vi.advanceTimersByTime(1500) })
      pressBack()
      expect(lower).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('closes only the top-most sheet per Back', () => {
    spyHistory()
    const lower = vi.fn()
    const upper = vi.fn()
    render(<><Sheet open onClose={lower} title="Lower"><button>a</button></Sheet><Sheet open onClose={upper} title="Upper"><button>b</button></Sheet></>)
    pressBack()
    expect(upper).toHaveBeenCalledTimes(1)
    expect(lower).not.toHaveBeenCalled()
  })

  it('leaves history alone for a plain Dialog and ignores Back', () => {
    const { push } = spyHistory()
    const onClose = vi.fn()
    render(<Dialog label="Plain" onClose={onClose}><button>x</button></Dialog>)
    pressBack()
    expect(push).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps the Next.js history state on the pushed entry', () => {
    window.history.replaceState({ __NA: true }, '')
    const { push } = spyHistory()
    render(<Sheet open onClose={() => {}} title="S"><button>x</button></Sheet>)
    expect(push.mock.calls[0][0]).toMatchObject({ __NA: true, kanviseSheet: true })
  })

  it('gives a ModalDialog its entry back when the unsaved-changes guard refuses to close', () => {
    const { push } = spyHistory()
    const onClose = vi.fn()
    render(
      <ModalDialog open onClose={onClose} title="Edit" subtitle="Change it" onRequestClose={() => false}>
        <button>x</button>
      </ModalDialog>,
    )
    expect(push).toHaveBeenCalledTimes(1)
    pressBack()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(push).toHaveBeenCalledTimes(2)
  })

  it('closes a ModalDialog on Back when nothing guards it', () => {
    spyHistory()
    const onClose = vi.fn()
    render(<ModalDialog open onClose={onClose} title="Edit" subtitle="Change it"><button>x</button></ModalDialog>)
    pressBack()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does nothing on Back after every sheet is gone', () => {
    const { back } = spyHistory()
    const { unmount } = render(<Sheet open onClose={() => {}} title="S"><button>x</button></Sheet>)
    unmount()
    expect(back).toHaveBeenCalledTimes(1)
    expect(() => { pressBack(); fireEvent.keyDown(document.body, { key: 'Escape' }) }).not.toThrow()
  })
})
