import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StudentMocksClient } from './student-mocks-client'
import type { StudentMockGroups, UnlockedMock } from '@/lib/student-mocks'

const mocks = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, push: mocks.push }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))
vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))

const emptyGroups: StudentMockGroups = { available: [], in_progress: [], upcoming: [], completed: [] }
const unlocked: UnlockedMock = {
  id: 'entitlement-1', attempts_granted: 1, attempts_consumed: 1, expires_at: null,
  current_attempt: { id: 'attempt-1', status: 'in_progress', started_at: '2026-09-09T10:00:00Z', deadline_at: '2099-09-09T11:00:00Z' },
  offer: {
    id: 'offer-1', access_mode: 'free_claim',
    mock: { id: 'mock-1', title: 'Mathematics practice', description: null, time_limit_minutes: 60, calculator_mode: 'none', school: { name: 'Bright Minds' } },
    version: { id: 'version-1', total_questions: 40, total_marks: 40 },
  },
}

describe('StudentMocksClient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lets a student continue an active attempt even when its allowance is consumed', () => {
    render(<StudentMocksClient groups={emptyGroups} unlocked={[unlocked]} initialView="unlocked" />)

    expect(screen.getByRole('link', { name: 'Continue mock' })).toHaveAttribute('href', '/attempt/attempt-1')
    expect(screen.queryByRole('button', { name: 'Attempts used' })).not.toBeInTheDocument()
  })

  it('distinguishes an empty library from a search with no matches', () => {
    render(<StudentMocksClient groups={emptyGroups} unlocked={[unlocked]} initialView="unlocked" />)
    fireEvent.change(screen.getByPlaceholderText('Search mocks or subjects'), { target: { value: 'Physics' } })

    expect(screen.getByText('No unlocked mocks match your search')).toBeInTheDocument()
    expect(screen.getByText('Try a different mock or tutorial name.')).toBeInTheDocument()
  })

  it('shows every programme status without a horizontally scrolling tab strip', () => {
    render(<StudentMocksClient groups={emptyGroups} unlocked={[]} initialView="programme" />)

    const filters = screen.getByRole('group', { name: 'Filter mock exams by status' })
    expect(filters).toHaveClass('grid', 'grid-cols-2')
    expect(filters).not.toHaveClass('overflow-x-auto')
    for (const label of ['Available', 'Continue', 'Upcoming', 'Completed']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeVisible()
    }
  })
})
