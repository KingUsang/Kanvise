import { describe, expect, it, vi } from 'vitest'
import { leaveByHistory, historyLeaveSteps, pushGuardEntry, updateDirtySources } from './UnsavedChangesContext'

describe('updateDirtySources', () => {
  it('keeps the guard active while another source stays dirty', () => {
    let sources: ReadonlySet<string> = new Set()
    sources = updateDirtySources(sources, 'a', true)
    sources = updateDirtySources(sources, 'b', true)
    sources = updateDirtySources(sources, 'a', false)
    expect(sources.size).toBe(1)
    expect(sources.has('b')).toBe(true)
    sources = updateDirtySources(sources, 'b', false)
    expect(sources.size).toBe(0)
  })

  it('returns the same set when nothing changes', () => {
    const sources = new Set(['a'])
    expect(updateDirtySources(sources, 'a', true)).toBe(sources)
    expect(updateDirtySources(sources, 'z', false)).toBe(sources)
  })
})

describe('pushGuardEntry', () => {
  it('pushes one marked entry and reuses it on later dirty cycles', () => {
    const before = window.history.length
    expect(pushGuardEntry()).toBe(true)
    expect(window.history.length).toBe(before + 1)
    expect(pushGuardEntry()).toBe(false)
    expect(pushGuardEntry()).toBe(false)
    expect(window.history.length).toBe(before + 1)
  })

  it('re-pushes when forced after a Back pop', () => {
    const before = window.history.length
    expect(pushGuardEntry(true)).toBe(true)
    expect(window.history.length).toBe(before + 1)
  })

  it('leaves by skipping the guard entry and the page entry', () => {
    expect(historyLeaveSteps()).toBe(-2)
  })
})

describe('leaveByHistory', () => {
  function fakeWindow(popOnGo: boolean) {
    const listeners = new Set<() => void>()
    return {
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      history: { go: vi.fn(() => { if (popOnGo) listeners.forEach((fn) => fn()) }) },
      setTimeout: (fn: () => void) => { fn(); return 0 },
    } as unknown as Window & { history: { go: ReturnType<typeof vi.fn> } }
  }

  it('goes back two entries and skips the fallback when history moved', () => {
    const win = fakeWindow(true)
    const fallback = vi.fn()
    leaveByHistory(fallback, win)
    expect(win.history.go).toHaveBeenCalledWith(-2)
    expect(fallback).not.toHaveBeenCalled()
  })

  it('uses the fallback on direct arrival when there is no earlier entry', () => {
    const win = fakeWindow(false)
    const fallback = vi.fn()
    leaveByHistory(fallback, win)
    expect(fallback).toHaveBeenCalledTimes(1)
  })
})
