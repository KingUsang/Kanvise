import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TimetableManager, currentWeekStart } from './timetable-manager'
import { toast } from 'sonner'

vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.example.test' }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const programmes = [{ id: 'programme-1', name: 'JAMB Science', courses: [{ id: 'course-1', name: 'Mathematics', tutor_ids: ['tutor-1'] }] }]
const tutors = [{ id: 'tutor-1', first_name: 'Ada', last_name: 'Okafor' }]

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('mobile timetable setup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts as an unpublished course-level draft', async () => {
    const user = userEvent.setup()
    let loaded = false
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        loaded = true
        return response({ data: { id: 'timetable-1', status: 'draft' } }, 201)
      }
      return response({ data: loaded ? [{ id: 'timetable-1', programme_id: 'programme-1', standalone_course_id: null, status: 'draft', timezone: 'Africa/Lagos', programme: { id: 'programme-1', name: 'JAMB Science' }, slots: [] }] : [] })
    }))

    render(<TimetableManager token="token" programmes={programmes} standaloneCourses={[]} tutors={tutors} />)
    await user.selectOptions(await screen.findByLabelText('Course'), 'programme:programme-1')
    await user.click(screen.getByRole('button', { name: 'Create timetable' }))

    expect(await screen.findByText('Draft · students cannot see it')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish timetable' })).toBeDisabled()
  })

  it('adds a weekly class by default and publishes only after explicit confirmation', async () => {
    const user = userEvent.setup()
    const calls: Array<{ url: string; options?: RequestInit }> = []
    let hasSlot = false
    let published = false
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      calls.push({ url, options })
      if (url.endsWith('/slots') && options?.method === 'POST') {
        hasSlot = true
        return response({ data: { id: 'slot-1' } }, 201)
      }
      if (url.endsWith('/publish') && options?.method === 'POST') {
        published = true
        return response({ message: 'Timetable published', generated_classes: 12 })
      }
      const slot = { id: 'slot-1', course_id: 'course-1', tutor_id: 'tutor-1', weekday: 4, start_time: '17:30:00', duration_minutes: 60, starts_on: currentWeekStart(), ends_on: null, course: { id: 'course-1', name: 'Mathematics' }, tutor: tutors[0] }
      return response({ data: [{ id: 'timetable-1', programme_id: 'programme-1', standalone_course_id: null, status: published ? 'published' : 'draft', timezone: 'Africa/Lagos', programme: { id: 'programme-1', name: 'JAMB Science' }, slots: hasSlot ? [slot] : [] }] })
    }))

    render(<TimetableManager token="token" programmes={programmes} standaloneCourses={[]} tutors={tutors} />)
    await screen.findByText('Draft · students cannot see it')
    await user.selectOptions(screen.getByLabelText('Subject'), 'course-1')
    await user.selectOptions(screen.getByLabelText('Day'), '4')
    await user.type(screen.getByLabelText('Time'), '17:30')
    expect(screen.getByRole('radio', { name: 'Every week' })).toBeChecked()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add class' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Add class' }))

    expect(await screen.findByText(/Thursday · 17:30 · 60 min · Every week/)).toBeInTheDocument()
    const addCall = calls.find(call => call.url.endsWith('/slots') && call.options?.method === 'POST')
    expect(JSON.parse(addCall?.options?.body as string)).toMatchObject({ recurrence: 'ongoing', week_start: currentWeekStart() })

    await user.click(screen.getByRole('button', { name: 'Publish timetable' }))
    expect(await screen.findByText('Published')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Timetable published to students')
  })
})
