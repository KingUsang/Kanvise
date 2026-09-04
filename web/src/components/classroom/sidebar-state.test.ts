import { describe, expect, it } from 'vitest'
import { INITIAL_SIDEBAR_STATE, sidebarReducer } from './sidebar-state'

const classroomEvents = [
  'mount', 'hydration', 'livekit-connect', 'livekit-reconnect', 'role-resolution',
  'participant-join', 'participant-leave', 'hand-raise', 'data-channel-sync',
  'breakpoint-change', 'orientation-change', 'presentation-activation',
]

describe('classroom sidebar reducer', () => {
  it.each(classroomEvents)('never opens on %s', (event) => {
    expect(sidebarReducer(INITIAL_SIDEBAR_STATE, { type: 'CLASSROOM_EVENT', event })).toEqual({ panel: null })
  })

  it('only opens from an explicit user action', () => {
    const opened = sidebarReducer(INITIAL_SIDEBAR_STATE, { type: 'USER_TOGGLE', panel: 'chat' })
    expect(opened.panel).toBe('chat')
    expect(sidebarReducer(opened, { type: 'CLASSROOM_EVENT', event: 'livekit-reconnect' })).toBe(opened)
  })

  it('resets on entry and class changes', () => {
    const open = { panel: 'participants' as const }
    expect(sidebarReducer(open, { type: 'CLASSROOM_ENTERED' }).panel).toBeNull()
    expect(sidebarReducer(open, { type: 'CLASS_CHANGED' }).panel).toBeNull()
  })

  it('closes without changing classroom state', () => {
    expect(sidebarReducer({ panel: 'chat' }, { type: 'CLOSE' })).toEqual({ panel: null })
  })

  it('stays closed at a phone viewport through the complete entry event sequence', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    let state = INITIAL_SIDEBAR_STATE
    for (const event of classroomEvents) state = sidebarReducer(state, { type: 'CLASSROOM_EVENT', event })
    window.dispatchEvent(new Event('orientationchange'))
    expect(window.innerWidth).toBe(390)
    expect(state.panel).toBeNull()
  })
})
