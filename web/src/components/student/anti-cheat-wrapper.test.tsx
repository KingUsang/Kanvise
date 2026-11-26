import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AntiCheatWrapper, AWAY_LIMIT_MS } from './anti-cheat-wrapper'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('AntiCheatWrapper away timer (DEV-QUIZ-030)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { setHidden(false); vi.useRealTimers() })

  it('submits after the page has been hidden for the limit', () => {
    const onAutoSubmit = vi.fn()
    render(<AntiCheatWrapper onAutoSubmit={onAutoSubmit}><p>q</p></AntiCheatWrapper>)
    act(() => setHidden(true))
    act(() => { vi.advanceTimersByTime(AWAY_LIMIT_MS) })
    expect(onAutoSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not reset the away clock when the parent re-renders with a new callback', () => {
    const first = vi.fn()
    const second = vi.fn()
    const view = render(<AntiCheatWrapper onAutoSubmit={first}><p>q</p></AntiCheatWrapper>)
    act(() => setHidden(true))
    act(() => { vi.advanceTimersByTime(AWAY_LIMIT_MS - 10_000) })
    view.rerender(<AntiCheatWrapper onAutoSubmit={second}><p>q</p></AntiCheatWrapper>)
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('counts wall-clock time away even if background timers were throttled', () => {
    const onAutoSubmit = vi.fn()
    render(<AntiCheatWrapper onAutoSubmit={onAutoSubmit}><p>q</p></AntiCheatWrapper>)
    act(() => setHidden(true))
    vi.setSystemTime(Date.now() + AWAY_LIMIT_MS + 5_000)
    act(() => setHidden(false))
    expect(onAutoSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not submit when the learner returns in time', () => {
    const onAutoSubmit = vi.fn()
    render(<AntiCheatWrapper onAutoSubmit={onAutoSubmit}><p>q</p></AntiCheatWrapper>)
    act(() => setHidden(true))
    act(() => { vi.advanceTimersByTime(30_000) })
    act(() => setHidden(false))
    act(() => { vi.advanceTimersByTime(AWAY_LIMIT_MS) })
    expect(onAutoSubmit).not.toHaveBeenCalled()
  })
})
