import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MockDraftPreview } from './mock-draft-preview'

const questions = [
  {
    id: 'english-1',
    subject: 'Use of English',
    text: 'Choose the correct word.',
    marks: 1,
    type: 'mcq' as const,
    options: [
      { id: 'english-a', text: 'Option A' },
      { id: 'english-b', text: 'Option B' },
    ],
  },
  {
    id: 'physics-1',
    subject: 'Physics',
    text: 'What is velocity?',
    marks: 2,
    type: 'theory' as const,
    options: [],
  },
]

describe('MockDraftPreview', () => {
  it('previews subject navigation without creating an attempt', () => {
    const onClose = vi.fn()
    render(<MockDraftPreview title="JAMB practice" description="Answer every subject." questions={questions} onClose={onClose} />)

    expect(screen.getByRole('navigation', { name: 'Preview subjects' })).toBeInTheDocument()
    expect(screen.getByText('Use of English · Question 1 of 1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Physics' }))
    expect(screen.getByText('Physics · Question 1 of 1')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Student’s written answer…')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Exit preview/ }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('supports an explicit mobile viewport preview', () => {
    render(<MockDraftPreview title="JAMB practice" description="" questions={questions} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Mobile preview' }))
    expect(screen.getByRole('button', { name: 'Mobile preview' })).toHaveClass('bg-[#eeeafe]')
  })
})
