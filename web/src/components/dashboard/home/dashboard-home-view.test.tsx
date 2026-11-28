import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DashboardHomeSkeleton, DashboardHomeView } from './dashboard-home-view'
import type { DashboardOverview, OverviewLesson } from '@/lib/dashboard-overview'

// Friday 27 November 2026, 14:00 in Lagos.
const now = new Date('2026-11-27T13:00:00Z')
const days = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']

const lesson = (overrides: Partial<OverviewLesson> = {}): OverviewLesson => ({
  id: 'l-1',
  title: 'Quadratics',
  scheduled_at: '2026-11-27T15:00:00Z',
  duration_minutes: 60,
  status: 'planned',
  course_id: 'c-1',
  course_name: 'Algebra 1 Small Group',
  student_count: 1,
  tutor_id: 't-1',
  tutor_name: null,
  ...overrides,
})

function overview(overrides: Partial<DashboardOverview> = {}): DashboardOverview {
  const today = overrides.today ?? []
  return {
    view: 'agency_tutor',
    teaches: true,
    scope: 'own',
    timezone: 'Africa/Lagos',
    classroom_opens_minutes: 15,
    has_any_lesson: today.length > 0,
    today,
    next_lesson: null,
    week: {
      offset: 0,
      today_index: 4,
      days: days.map((date) => ({ date, lesson_count: 0 })),
      lessons: [],
    },
    ...overrides,
  }
}

function renderView(data: DashboardOverview, props: Partial<Parameters<typeof DashboardHomeView>[0]> = {}) {
  const onWeekChange = vi.fn()
  const onMineOnlyChange = vi.fn()
  render(<DashboardHomeView overview={data} firstName="Michael" now={now} mineOnly={false} onMineOnlyChange={onMineOnlyChange} onWeekChange={onWeekChange} {...props} />)
  return { onWeekChange, onMineOnlyChange }
}

describe('dashboard header (DB-01)', () => {
  it('greets by local time with the date line and no emoji', () => {
    renderView(overview())
    expect(screen.getByRole('heading', { level: 1, name: 'Good afternoon, Michael' })).toBeInTheDocument()
    expect(screen.getByText('Friday, 27 November 2026')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('uses the viewer zone for the greeting', () => {
    renderView(overview({ timezone: 'Pacific/Auckland' }))
    // 02:00 on Saturday in Auckland.
    expect(screen.getByRole('heading', { level: 1, name: 'Good morning, Michael' })).toBeInTheDocument()
    expect(screen.getByText('Saturday, 28 November 2026')).toBeInTheDocument()
  })
})

describe('Today (DB-03)', () => {
  it('lists lessons with times, students, course and a status chip', () => {
    renderView(overview({ today: [lesson(), lesson({ id: 'l-2', title: 'Graphs', status: 'live', student_count: 3, scheduled_at: '2026-11-27T17:00:00Z' })] }))
    const today = screen.getByRole('region', { name: /Today/ })
    expect(within(today).getByText('2 lessons')).toBeInTheDocument()
    expect(within(today).getByText('4:00 PM')).toBeInTheDocument()
    expect(within(today).getByText('1 student · Algebra 1 Small Group')).toBeInTheDocument()
    expect(within(today).getByText('3 students · Algebra 1 Small Group')).toBeInTheDocument()
    expect(within(today).getByText('Planned')).toBeInTheDocument()
    expect(within(today).getByText('Live')).toBeInTheDocument()
    expect(within(today).getByRole('link', { name: 'Open calendar ›' })).toHaveAttribute('href', '/dashboard/schedule')
  })

  it('says when there are no lessons today and names the next one', () => {
    renderView(overview({ has_any_lesson: true, next_lesson: lesson({ scheduled_at: '2026-11-30T09:00:00Z' }) }))
    expect(screen.getByText('No lessons today.')).toBeInTheDocument()
    expect(screen.getByText('Your next lesson is Monday, 10:00 AM · Algebra 1 Small Group.')).toBeInTheDocument()
  })

  it('says nothing is scheduled when no lesson exists at all', () => {
    renderView(overview())
    expect(screen.getByText('Nothing scheduled yet.')).toBeInTheDocument()
  })

  it('strikes through cancelled lessons and labels Not held', () => {
    renderView(overview({ today: [lesson({ status: 'cancelled' }), lesson({ id: 'l-2', title: 'Missed one', status: 'not-held' })] }))
    expect(screen.getByText('Quadratics').closest('p')).toHaveClass('line-through')
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByText('Not held')).toBeInTheDocument()
  })
})

describe('role views', () => {
  it('independent and agency tutors do not see tutor names or the Mine only toggle', () => {
    renderView(overview({ view: 'independent', today: [lesson()] }))
    expect(screen.queryByText(/with /)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mine only' })).not.toBeInTheDocument()
  })

  it('agency admins see "with {tutor}" and can narrow to their own lessons', () => {
    const { onMineOnlyChange } = renderView(overview({ view: 'agency_admin', scope: 'all', today: [lesson({ tutor_name: 'Michael Chen' })] }))
    expect(screen.getByText('1 student · Algebra 1 Small Group · with Michael Chen')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mine only' }))
    expect(onMineOnlyChange).toHaveBeenCalledWith(true)
  })

  it('hides Mine only for an admin who teaches nothing', () => {
    renderView(overview({ view: 'agency_admin', scope: 'all', teaches: false }))
    expect(screen.queryByRole('button', { name: 'Mine only' })).not.toBeInTheDocument()
  })
})

describe('This week (DB-04)', () => {
  const week = (counts: number[]): DashboardOverview['week'] => ({
    offset: 0,
    today_index: 4,
    days: days.map((date, index) => ({ date, lesson_count: counts[index] ?? 0 })),
    lessons: [
      { ...lesson({ id: 'w-1', title: 'Thursday lesson', scheduled_at: '2026-11-26T09:00:00Z' }), day_index: 3 },
      { ...lesson({ id: 'w-2', title: 'Saturday lesson', scheduled_at: '2026-11-28T09:00:00Z' }), day_index: 5 },
    ],
  })

  it('shows seven day tiles with accessible lesson counts and marks today', () => {
    renderView(overview({ week: week([0, 0, 0, 1, 0, 1, 0]) }))
    expect(screen.getAllByRole('button', { name: /^\w+day, \d+ lessons?$/ })).toHaveLength(7)
    expect(screen.getByRole('button', { name: 'Thursday, 1 lesson' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Friday, 0 lessons' })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByText('23 to 29 November')).toBeInTheDocument()
  })

  it('filters the list to one day and clears on a second press', () => {
    renderView(overview({ week: week([0, 0, 0, 1, 0, 1, 0]) }))
    expect(screen.getByText('Thursday lesson')).toBeInTheDocument()
    expect(screen.getByText('Saturday lesson')).toBeInTheDocument()
    const thursday = screen.getByRole('button', { name: 'Thursday, 1 lesson' })
    fireEvent.click(thursday)
    expect(thursday).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Saturday lesson')).not.toBeInTheDocument()
    fireEvent.click(thursday)
    expect(screen.getByText('Saturday lesson')).toBeInTheDocument()
  })

  it('moves between weeks', () => {
    const { onWeekChange } = renderView(overview())
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(onWeekChange).toHaveBeenLastCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(onWeekChange).toHaveBeenLastCalledWith(-1)
  })

  it('has an empty state', () => {
    renderView(overview())
    expect(screen.getByText('Nothing scheduled this week.')).toBeInTheDocument()
  })
})

describe('links to unshipped screens stay hidden', () => {
  it('renders none of the later-step controls', () => {
    renderView(overview({ view: 'agency_admin', scope: 'all', today: [lesson({ status: 'starting-soon' })] }))
    for (const name of [/Schedule lesson/, /^Join/, /Live now/, /Needs attention/, /Suggestions/, /sample course/i, /All lessons/, /Write summary/]) {
      expect(screen.queryByText(name)).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs.every((href) => href === '/dashboard/schedule')).toBe(true)
  })
})

describe('loading', () => {
  it('renders a labelled skeleton group straight away', () => {
    render(<DashboardHomeSkeleton />)
    expect(screen.getByRole('status', { name: 'Loading your dashboard' })).toHaveAttribute('aria-busy', 'true')
  })
})
