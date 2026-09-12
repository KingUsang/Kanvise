import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UploadTaskStatus } from './upload-task-status'

describe('UploadTaskStatus', () => {
  it('reports measurable transfer progress', () => {
    render(<UploadTaskStatus label="Uploading question image" progress={42} />)
    expect(screen.getByRole('progressbar', { name: 'Uploading question image' })).toHaveAttribute('aria-valuenow', '42')
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('does not invent a percentage for server processing', () => {
    render(<UploadTaskStatus label="Saving question" progress={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('Saving question')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
