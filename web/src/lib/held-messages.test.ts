import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  undo: vi.fn(),
}))

vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))
vi.mock('@/lib/api-request', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('@/lib/toast', () => ({ toast: { undo: mocks.undo } }))

import { undoableAction } from './held-messages'

type UndoOptions = { text: string; onUndo: () => void; onWindowClosed: () => void }
const lastToast = () => mocks.undo.mock.calls.at(-1)![0] as UndoOptions
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('undoableAction (NTF-03)', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset()
    mocks.undo.mockReset()
    mocks.undo.mockReturnValue({ close: vi.fn() })
  })

  it('shows the Undo toast with the action text', () => {
    undoableAction({ text: 'Lesson moved to Tue 2 Dec, 10:00 AM.', heldMessageId: 'held-1', onUndo: vi.fn() })
    expect(lastToast().text).toBe('Lesson moved to Tue 2 Dec, 10:00 AM.')
  })

  it('Undo cancels the held message, then puts the action back', async () => {
    const order: string[] = []
    mocks.apiRequest.mockImplementation(async () => { order.push('api'); return { data: {} } })
    undoableAction({ text: 'Lesson cancelled.', heldMessageId: 'held-1', onUndo: () => { order.push('undo') } })
    lastToast().onUndo()
    await flush()
    expect(mocks.apiRequest).toHaveBeenCalledWith('https://api.example.test/held-messages/held-1/undo', expect.any(String), { method: 'POST' })
    expect(order).toEqual(['api', 'undo'])
  })

  it('still puts the action back when the API call fails, and reports it', async () => {
    const onUndo = vi.fn()
    const onUndoError = vi.fn()
    mocks.apiRequest.mockRejectedValue(new Error('offline'))
    undoableAction({ text: 'Lesson cancelled.', heldMessageId: 'held-1', onUndo, onUndoError })
    lastToast().onUndo()
    await flush()
    expect(onUndo).toHaveBeenCalledOnce()
    expect(onUndoError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('releases the message when the window closes, and ignores a failure', async () => {
    mocks.apiRequest.mockRejectedValue(new Error('offline'))
    undoableAction({ text: 'Lesson moved.', heldMessageId: 'held 2', onUndo: vi.fn() })
    lastToast().onWindowClosed()
    await flush()
    expect(mocks.apiRequest).toHaveBeenCalledWith('https://api.example.test/held-messages/held%202/release', expect.any(String), { method: 'POST', keepalive: true })
  })
})
