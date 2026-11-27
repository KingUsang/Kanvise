import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryFailure } from './query-error-state'

const base = { isError: true, isFetching: false, data: undefined, error: new Error('db password leaked'), refetch: vi.fn() }

describe('QueryFailure', () => {
  it('renders nothing while the query is healthy', () => {
    const { container } = render(<QueryFailure query={{ ...base, isError: false }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a safe full error with retry when no data was ever loaded', () => {
    const refetch = vi.fn()
    render(<QueryFailure query={{ ...base, refetch }} fallback="We could not load this." />)
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load this.')
    expect(screen.queryByText(/leaked/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('keeps cached data usable by showing only a non-blocking warning after a failed refresh', () => {
    const refetch = vi.fn()
    render(<QueryFailure query={{ ...base, data: { rows: [1] }, refetch }} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Showing the last loaded data')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalled()
  })
})
