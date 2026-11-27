import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StudentMocksClient } from './student-mocks-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { StudentMockGroups } from '@/lib/student-mocks'

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))
vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))

const emptyGroups: StudentMockGroups = { available: [], in_progress: [], upcoming: [], completed: [] }
const card = {
  id: 'mock-1', title: 'Mathematics practice', description: null, course_id: 'course-1', course: { name: 'Maths' },
  available_from: null, closes_at: null, time_limit_minutes: 60, calculator_mode: 'none' as const,
  attempts_used: 1, attempts_allowed: 2, version: { id: 'version-1', total_questions: 40, total_marks: 40 },
  attempt: { id: 'attempt-1', status: 'in_progress', deadline_at: '2099-09-09T11:00:00Z', submitted_at: null, total_score: null, total_marks: null },
}

describe('StudentMocksClient', () => {
  beforeEach(() => vi.clearAllMocks())

  function renderMocks(groups: StudentMockGroups) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={queryClient}><StudentMocksClient groups={groups} /></QueryClientProvider>)
  }

  it('lets a learner continue an active Class quiz attempt', () => {
    renderMocks({ ...emptyGroups, in_progress: [card] })

    expect(screen.getByRole('link', { name: /Continue quiz/ })).toHaveAttribute('href', '/dashboard/student/mocks/attempt/attempt-1')
  })

  it('has no unlocked or purchased library, only Class quizzes', () => {
    renderMocks({ ...emptyGroups, available: [{ ...card, attempt: undefined }] })

    expect(screen.queryByText(/unlocked/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/purchased/i)).not.toBeInTheDocument()
    expect(screen.getByText('Mathematics practice')).toBeInTheDocument()
  })

  it('distinguishes an empty list from a search with no matches', () => {
    renderMocks({ ...emptyGroups, available: [{ ...card, attempt: undefined }] })
    fireEvent.change(screen.getByPlaceholderText('Search quizzes or subjects'), { target: { value: 'Physics' } })

    expect(screen.getByText('No quizzes match your search')).toBeInTheDocument()
  })

  it('shows every status without a horizontally scrolling tab strip', () => {
    renderMocks(emptyGroups)

    const filters = screen.getByRole('group', { name: 'Filter quizzes by status' })
    expect(filters).toHaveClass('grid', 'grid-cols-2')
    expect(filters).not.toHaveClass('overflow-x-auto')
    for (const label of ['Available', 'Continue', 'Upcoming', 'Completed']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeVisible()
    }
  })
})
