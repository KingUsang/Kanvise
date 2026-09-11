import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MockBuilderStepProgress } from './mock-builder-step-progress'

const steps = [
  { id: 'setup', label: 'Basics' },
  { id: 'questions', label: 'Questions' },
  { id: 'settings', label: 'Share & publish' },
  { id: 'review', label: 'Review' },
]

describe('MockBuilderStepProgress', () => {
  it('shows compact, accessible progress for the current mobile step', () => {
    render(<MockBuilderStepProgress steps={steps} currentStepId="questions" visitedStepIds={new Set(['setup', 'questions'])} onStepSelect={() => undefined} />)

    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Mock creation progress' })).toHaveAttribute('aria-valuenow', '2')
  })

  it('keeps a previously visited step available after going back', () => {
    const onStepSelect = vi.fn()
    render(<MockBuilderStepProgress steps={steps} currentStepId="setup" visitedStepIds={new Set(['setup', 'questions'])} onStepSelect={onStepSelect} />)

    const questions = screen.getByRole('button', { name: '2. Questions' })
    expect(questions).toBeEnabled()
    fireEvent.click(questions)
    expect(onStepSelect).toHaveBeenCalledWith('questions')
    expect(screen.getByRole('button', { name: '3. Share & publish' })).toBeDisabled()
  })
})
