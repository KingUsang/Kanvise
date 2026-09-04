import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({
  mode: 'presentation' as 'presentation' | 'whiteboard',
  active: { id: 'material-1' } as any,
  materials: [{ id: 'material-1' }] as any[],
  setMaterialsOpen: vi.fn(),
  closePresentation: vi.fn(),
}))
vi.mock('./presentation-session', () => ({ usePresentationSession: () => session }))

import PresentationControls from './PresentationControls'

describe('presentation teaching mode controls', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens Materials only from the tutor button', () => {
    render(<PresentationControls />)
    fireEvent.click(screen.getByTitle('Presentation materials'))
    expect(session.setMaterialsOpen).toHaveBeenCalledWith(true)
  })

  it('switches an active presentation back to the separate whiteboard mode', () => {
    render(<PresentationControls />)
    fireEvent.click(screen.getByTitle('Whiteboard'))
    expect(session.closePresentation).toHaveBeenCalledOnce()
  })
})
