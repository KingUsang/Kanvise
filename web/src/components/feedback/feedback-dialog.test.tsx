import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeedbackDialog } from './feedback-dialog'

vi.mock('@sentry/nextjs', () => ({ lastEventId: () => undefined }))

describe('FeedbackDialog', () => {
  it('portals the modal to the document body so dashboard stacking contexts cannot cover it', () => {
    const { container } = render(<div data-testid="header"><FeedbackDialog compact /></div>)

    fireEvent.click(screen.getByRole('button', { name: 'Report a problem' }))

    const dialogHeading = screen.getByRole('heading', { name: 'Help improve Kanvise' })
    expect(document.body.contains(dialogHeading)).toBe(true)
    expect(container.contains(dialogHeading)).toBe(false)
  })
})
