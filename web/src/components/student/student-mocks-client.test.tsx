import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StudentMocksClient } from './student-mocks-client'
import type { StudentMockGroups } from '@/lib/student-mocks'

const emptyGroups: StudentMockGroups = {
  available: [],
  in_progress: [],
  upcoming: [],
  completed: [],
}

describe('StudentMocksClient', () => {
  it('shows every status without a horizontally scrolling tab strip', () => {
    render(<StudentMocksClient groups={emptyGroups} />)

    const filters = screen.getByRole('group', { name: 'Filter mock exams by status' })
    expect(filters).toHaveClass('grid', 'grid-cols-2')
    expect(filters).not.toHaveClass('overflow-x-auto')
    for (const label of ['Available', 'Continue', 'Upcoming', 'Completed']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeVisible()
    }
  })
})
