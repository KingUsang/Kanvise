export type ClassroomPanel = 'chat' | 'participants'
export type SidebarState = { panel: ClassroomPanel | null }

export type SidebarAction =
  | { type: 'USER_TOGGLE'; panel: ClassroomPanel }
  | { type: 'USER_OPEN'; panel: ClassroomPanel }
  | { type: 'CLOSE' }
  | { type: 'CLASSROOM_ENTERED' }
  | { type: 'CLASS_CHANGED' }
  | { type: 'CLASSROOM_EVENT'; event: string }

export const INITIAL_SIDEBAR_STATE: SidebarState = { panel: null }

// USER_TOGGLE/USER_OPEN are the only actions allowed to open a panel. All
// LiveKit, hydration, breakpoint, orientation, and presentation events are
// deliberately inert with respect to drawer visibility.
export function sidebarReducer(state: SidebarState, action: SidebarAction): SidebarState {
  switch (action.type) {
    case 'USER_TOGGLE':
      return { panel: state.panel === action.panel ? null : action.panel }
    case 'USER_OPEN':
      return { panel: action.panel }
    case 'CLOSE':
    case 'CLASSROOM_ENTERED':
    case 'CLASS_CHANGED':
      return INITIAL_SIDEBAR_STATE
    case 'CLASSROOM_EVENT':
      return state
  }
}
