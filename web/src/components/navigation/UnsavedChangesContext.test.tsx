import { describe, expect, it } from 'vitest'
import { historyLeaveSteps, pushGuardEntry, updateDirtySources } from './UnsavedChangesContext'

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
