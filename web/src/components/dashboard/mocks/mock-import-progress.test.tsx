import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MockImportProgressCard, newMockImportProgress } from './mock-import-progress'

describe('mock import progress', () => {
  it('starts with a traceable job and a real file-received milestone', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('9147c666-0000-4000-8000-000000000000')
    expect(newMockImportProgress('questions.pdf')).toEqual({
      id: '9147c666', fileName: 'questions.pdf', phase: 'reading', percent: 5,
    })
  })

  it('shows completed, current and pending parsing stages', () => {
    render(<MockImportProgressCard progress={{ id: '9147c666', fileName: 'questions.pdf', phase: 'parsing', percent: 30 }} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
    expect(screen.getByText('30% complete')).toBeInTheDocument()
    expect(screen.getByText('AI parsing question blocks').closest('li')).toHaveClass('font-semibold')
    expect(screen.getByText('Questions structured and validated').closest('li')).not.toHaveClass('font-semibold')
  })
})
