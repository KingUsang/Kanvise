import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatCard } from './stat-card'
import { NeedsGradingCard } from './needs-grading-card'

describe('compact mobile dashboard summaries', () => {
  it('keeps secondary metric copy out of the initial phone layout', () => {
    render(<StatCard title="Enrolled students" value={42} icon="groups" subtitle="Across the centre" />)

    expect(screen.getByText('42')).toHaveClass('text-[24px]')
    expect(screen.getByText('Across the centre')).toHaveClass('hidden', 'sm:block')
  })

  it('uses a compact empty grading state', () => {
    render(<NeedsGradingCard items={[]} />)

    expect(screen.getByText('All caught up')).toBeInTheDocument()
    expect(screen.getByText('Nothing needs grading right now.')).toBeInTheDocument()
    expect(screen.queryByText(/no pending assignments/i)).not.toBeInTheDocument()
  })
})
