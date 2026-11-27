import { describe, expect, it } from 'vitest'
import { updateDirtySources } from './UnsavedChangesContext'

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
