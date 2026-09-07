import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConnectionState } from 'livekit-client'
import ClassroomLayout from './ClassroomLayout'

const room = {
  disconnect: vi.fn(),
  localParticipant: { metadata: '{"isHost":true}' },
  off: vi.fn(),
  on: vi.fn(),
  remoteParticipants: new Map(),
}

vi.mock('@livekit/components-react', () => ({
  useConnectionState: () => ConnectionState.Connected,
  useLocalParticipant: () => ({ localParticipant: { attributes: {}, setAttributes: vi.fn() } }),
  useParticipants: () => [],
  useRoomContext: () => room,
}))

vi.mock('./AudioVideoControls', () => ({ default: () => null }))
vi.mock('./ChatBox', () => ({ default: () => null }))
vi.mock('./ParticipantsPanel', () => ({ default: () => null }))
vi.mock('./PresentationControls', () => ({ default: () => null }))
vi.mock('./PresentationStage', () => ({ default: () => <div data-testid="teaching-stage" /> }))
vi.mock('./VideoPiP', () => ({ default: () => null }))
vi.mock('./presentation-session', () => ({
  PresentationSessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('ClassroomLayout overflow isolation', () => {
  it('uses a clipping viewport that cannot be horizontally scrolled by the closed drawer', () => {
    const { container } = render(
      <ClassroomLayout isHost classId="class-1" classTitle="Physics" courseName="Science" />,
    )

    const viewport = container.querySelector('[data-classroom-main]')
    expect(viewport).toHaveClass('overflow-clip')
    expect(viewport).not.toHaveClass('overflow-hidden')

    fireEvent.click(screen.getByRole('button', { name: 'People' }))
    expect(viewport).toHaveClass('overflow-clip')
    expect(screen.getByTestId('teaching-stage')).toBeInTheDocument()
  })
})
