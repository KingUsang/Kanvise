import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentDashboardPage from './page'

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    isPending: false,
    isError: false,
    data: {
      student: { first_name: 'Ada', last_name: 'Student' },
      school: { name: 'Bright Minds' },
      capabilities: { hasCentreLearning: true },
      course_count: 1,
      next_class: null,
      upcoming_classes: [],
      assignments_due: [],
      recent_updates: [{
        id: 'update-1',
        type: 'assignment',
        title: 'A'.repeat(200),
        course_name: 'B'.repeat(200),
        href: '/dashboard/student/assignments',
      }],
    },
  }),
}))

describe('StudentDashboardPage mobile layout', () => {
  it('uses a zero-minimum grid column so long updates cannot widen the viewport', () => {
    render(<StudentDashboardPage />)

    expect(screen.getByTestId('student-dashboard-grid')).toHaveClass(
      'min-w-0',
      'grid-cols-[minmax(0,1fr)]',
    )
  })
})
