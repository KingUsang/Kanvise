import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PlugNmeetClassroom from './PlugNmeetClassroom'

const replace = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

const props = {
  roomId: 'room-1',
  joinToken: 'token-1',
  serverUrl: 'https://meet.example.com',
  clientFiles: { css_files: [], js_files: [] },
  classId: 'class-1',
  classTitle: 'Physics',
  isHost: true,
}

describe('PlugNmeetClassroom lifecycle', () => {
  const leave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    window.plugNmeet = { leave }
  })

  afterEach(() => {
    delete window.plugNmeet
  })

  it('does not explicitly leave the meeting when React unmounts during reload', () => {
    const view = render(<PlugNmeetClassroom {...props} />)

    view.unmount()

    expect(leave).not.toHaveBeenCalled()
  })

  it('still leaves after the user confirms the explicit Leave class action', () => {
    render(<PlugNmeetClassroom {...props} />)
    act(() => window.dispatchEvent(new PopStateEvent('popstate')))

    fireEvent.click(screen.getByRole('button', { name: 'Leave class' }))

    expect(leave).toHaveBeenCalledOnce()
    expect(replace).toHaveBeenCalledWith('/dashboard')
  })
})
