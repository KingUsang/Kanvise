import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MockImportProgressCard, newMockImportProgress } from './mock-import-progress'

describe('mock import progress', () => {
  it('starts an import job for a selected file', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('9147c666-0000-4000-8000-000000000000')
    expect(newMockImportProgress('questions.pdf')).toEqual({
      id: '9147c666', fileName: 'questions.pdf', phase: 'reading', percent: null,
    })
  })

  it('shows the current honest import stage without inventing a percentage', () => {
    render(<MockImportProgressCard progress={{ id: '9147c666', fileName: 'questions.pdf', phase: 'parsing', percent: null }} />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText('Organising your questions')).toBeInTheDocument()
    expect(screen.getByText(/structuring questions, options and subject sections/i)).toBeInTheDocument()
  })

  it('shows a review-ready state only after the server returns questions', () => {
    render(<MockImportProgressCard progress={{ id: '9147c666', fileName: 'questions.pdf', phase: 'complete', percent: 100 }} />)
    expect(screen.getByText('Questions ready to review')).toBeInTheDocument()
    expect(screen.getByText(/found editable questions/i)).toBeInTheDocument()
  })
})
