import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Options = {
  id: string
  duration?: number
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
}

const sonnerMock = vi.hoisted(() => {
  const fn = vi.fn() as ReturnType<typeof vi.fn> & Record<string, ReturnType<typeof vi.fn>>
  fn.success = vi.fn()
  fn.info = vi.fn()
  fn.dismiss = vi.fn()
  return fn
})

vi.mock('sonner', () => ({ toast: sonnerMock }))

import { closeActionToasts, resetToastStateForTests, toast, TOAST_DURATION_MS, UNDO_WINDOW_MS } from './toast'

function lastUndoOptions(): Options {
  return sonnerMock.mock.calls.at(-1)?.[1] as Options
}

describe('toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetToastStateForTests()
    sonnerMock.mockClear()
    sonnerMock.success.mockClear()
    sonnerMock.info.mockClear()
    sonnerMock.dismiss.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows success for 4 seconds and replaces the current toast', () => {
    toast.success('Course created')
    expect(sonnerMock.success).toHaveBeenCalledWith('Course created', expect.objectContaining({ duration: TOAST_DURATION_MS }))
    const firstId = sonnerMock.success.mock.calls[0][1].id
    toast.info('Lesson moved to Tuesday')
    expect(sonnerMock.dismiss).toHaveBeenCalledWith(firstId)
    expect(sonnerMock.info).toHaveBeenCalledWith('Lesson moved to Tuesday', expect.objectContaining({ duration: TOAST_DURATION_MS }))
  })

  it('calls onWindowClosed once after 5 minutes', () => {
    const onUndo = vi.fn()
    const onWindowClosed = vi.fn()
    toast.undo({ text: 'Lesson cancelled', onUndo, onWindowClosed })
    expect(lastUndoOptions().duration).toBe(Number.POSITIVE_INFINITY)
    vi.advanceTimersByTime(UNDO_WINDOW_MS - 1)
    expect(onWindowClosed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onWindowClosed).toHaveBeenCalledTimes(1)
    lastUndoOptions().onDismiss?.()
    vi.advanceTimersByTime(UNDO_WINDOW_MS)
    expect(onWindowClosed).toHaveBeenCalledTimes(1)
    expect(onUndo).not.toHaveBeenCalled()
  })

  it('calls onWindowClosed once when dismissed', () => {
    const onWindowClosed = vi.fn()
    toast.undo({ text: 'Homework deleted', onUndo: vi.fn(), onWindowClosed })
    const options = lastUndoOptions()
    options.onDismiss?.()
    options.onDismiss?.()
    vi.advanceTimersByTime(UNDO_WINDOW_MS)
    expect(onWindowClosed).toHaveBeenCalledTimes(1)
  })

  it('calls onWindowClosed once on pagehide and when the route changes', () => {
    const onPageHide = vi.fn()
    toast.undo({ text: 'Lesson cancelled', onUndo: vi.fn(), onWindowClosed: onPageHide })
    window.dispatchEvent(new Event('pagehide'))
    window.dispatchEvent(new Event('pagehide'))
    expect(onPageHide).toHaveBeenCalledTimes(1)

    const onRoute = vi.fn()
    toast.undo({ text: 'Lesson cancelled', onUndo: vi.fn(), onWindowClosed: onRoute })
    closeActionToasts()
    closeActionToasts()
    vi.advanceTimersByTime(UNDO_WINDOW_MS)
    expect(onRoute).toHaveBeenCalledTimes(1)
  })

  it('never calls onWindowClosed after Undo', () => {
    const onUndo = vi.fn()
    const onWindowClosed = vi.fn()
    toast.undo({ text: 'Lesson cancelled', onUndo, onWindowClosed })
    const options = lastUndoOptions()
    expect(options.action?.label).toBe('Undo')
    options.action?.onClick()
    options.onDismiss?.()
    window.dispatchEvent(new Event('pagehide'))
    vi.advanceTimersByTime(UNDO_WINDOW_MS)
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onWindowClosed).not.toHaveBeenCalled()
    expect(sonnerMock.dismiss).toHaveBeenCalledWith(options.id)
  })

  it('makes a new plain toast wait behind an undo toast', () => {
    const onWindowClosed = vi.fn()
    toast.undo({ text: 'Lesson cancelled', onUndo: vi.fn(), onWindowClosed })
    toast.success('Course created')
    toast.success('Student added')
    expect(sonnerMock.success).not.toHaveBeenCalled()
    lastUndoOptions().onDismiss?.()
    expect(onWindowClosed).toHaveBeenCalledTimes(1)
    expect(sonnerMock.success).toHaveBeenCalledTimes(1)
    expect(sonnerMock.success).toHaveBeenCalledWith('Student added', expect.anything())
  })

  it('closes the older undo window when a newer undo toast arrives', () => {
    const first = vi.fn()
    const second = vi.fn()
    toast.undo({ text: 'Lesson A cancelled', onUndo: vi.fn(), onWindowClosed: first })
    toast.undo({ text: 'Lesson B cancelled', onUndo: vi.fn(), onWindowClosed: second })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })
})
