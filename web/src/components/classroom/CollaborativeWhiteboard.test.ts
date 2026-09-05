import { describe, expect, it, vi } from 'vitest'
import { syncWhiteboardBounds } from './CollaborativeWhiteboard'

describe('whiteboard stage bounds', () => {
  it('copies the classroom stage dimensions into Excalidraw on first load', () => {
    const updateScene = vi.fn()
    const api = {
      getAppState: () => ({ width: 1440, height: 900, offsetLeft: 0, offsetTop: 0 }),
      updateScene,
    }
    const container = {
      getBoundingClientRect: () => ({ width: 1060, height: 680, left: 0, top: 56 }),
    } as HTMLElement

    expect(syncWhiteboardBounds(api, container)).toBe(true)
    expect(updateScene).toHaveBeenCalledWith({
      appState: { width: 1060, height: 680, offsetLeft: 0, offsetTop: 56 },
    })
  })

  it('does not cause an update loop once the dimensions match', () => {
    const updateScene = vi.fn()
    const api = {
      getAppState: () => ({ width: 1060, height: 680, offsetLeft: 0, offsetTop: 56 }),
      updateScene,
    }
    const container = {
      getBoundingClientRect: () => ({ width: 1060, height: 680, left: 0, top: 56 }),
    } as HTMLElement

    expect(syncWhiteboardBounds(api, container)).toBe(false)
    expect(updateScene).not.toHaveBeenCalled()
  })
})
