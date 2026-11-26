import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './action-controls'
import { EmptyState, ErrorState, PageLoadingState, RefreshNotice, SectionLoadingState } from './async-states'

describe('canonical async states', () => {
  it('marks page and section loading without motion dependence', () => {
    render(
      <>
        <PageLoadingState label="Loading classes" />
        <SectionLoadingState label="Loading class information" cards={2} />
      </>,
    )

    expect(screen.getByRole('status', { name: 'Loading classes' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status', { name: 'Loading classes' })).toHaveClass('motion-reduce:animate-none')
    expect(screen.getByRole('status', { name: 'Loading class information' })).toHaveAttribute('aria-busy', 'true')
  })

  it('renders successful empty state with its relevant action', () => {
    const onCreate = vi.fn()
    render(<EmptyState icon={<span aria-hidden="true">+</span>} title="Create your first class" body="Add a subject to begin." action={<Button onClick={onCreate}>Create class</Button>} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create class' }))
    expect(onCreate).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: 'Create your first class' })).toBeInTheDocument()
  })

  it('uses an assertive initial error with a retry callback', () => {
    const onRetry = vi.fn()
    render(<ErrorState message="We could not load your classes." onRetry={onRetry} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('uses a polite refresh status for retained cached content', () => {
    const onRetry = vi.fn()
    render(<RefreshNotice message="Class refresh failed; showing your last saved classes." onRetry={onRetry} />)

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
