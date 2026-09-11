import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScheduleClient } from './schedule-client'
import { toast } from 'sonner'

const navigation = vi.hoisted(() => ({ push: vi.fn(), mode: null as string | null }))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => ({ get: () => navigation.mode }),
}))
vi.mock('@/components/navigation/NavigationProgress', () => ({ startNavigationProgress: vi.fn() }))

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockProgrammes = [
  { id: 'programme-1', name: 'JAMB Science', courses: [{ id: 'course-1', name: 'Mathematics' }] },
  { id: 'programme-2', name: 'WAEC Weekend', courses: [{ id: 'course-2', name: 'Mathematics' }] },
]
const mockTutors = [{ id: 'tutor-2', first_name: 'John', last_name: 'Doe' }]
const adminProps = { token: 'fake-token', capabilities: { isAdmin: true, isTutor: false }, user: { id: 'admin-1', first_name: 'Admin', last_name: 'User' } }
const tutorProps = { token: 'fake-token', capabilities: { isAdmin: false, isTutor: true }, user: { id: 'tutor-1', first_name: 'Jane', last_name: 'Smith' } }

function configureInitialRequests(assignedTutorId = 'tutor-2') {
  mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
    if (options?.method === 'POST') return { ok: true, json: async () => ({ data: { id: 'new-class' } }) }
    if (url.includes('/courses/') && url.includes('/tutors')) return { ok: true, json: async () => ({ data: [{ tutor_id: assignedTutorId }] }) }
    if (url.includes('/live-classes')) return { ok: true, json: async () => ({ data: [] }) }
    if (url.includes('/programmes')) return { ok: true, json: async () => ({ data: mockProgrammes }) }
    if (url.includes('/users?roles=admin,tutor')) return { ok: true, json: async () => ({ data: mockTutors }) }
    return { ok: true, json: async () => ({ data: [] }) }
  })
}

describe('Classes page actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigation.mode = null
    configureInitialRequests()
  })

  it('starts with two clear actions instead of an always-open scheduling form', async () => {
    render(<ScheduleClient {...adminProps} />)

    expect(await screen.findByRole('heading', { name: 'Classes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start now/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Schedule$/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('What are you teaching?')).not.toBeInTheDocument()
  })

  it('starts a tutor class from one grouped subject choice', async () => {
    const user = userEvent.setup()
    render(<ScheduleClient {...tutorProps} />)
    await screen.findByRole('heading', { name: 'No classes scheduled yet' })

    await user.click(screen.getByRole('button', { name: /Start now/i }))
    const subject = screen.getByLabelText('What are you teaching?')
    expect(screen.getAllByRole('group').map(group => group.getAttribute('label'))).toEqual(expect.arrayContaining(['JAMB Science', 'WAEC Weekend']))
    await user.selectOptions(subject, 'course-1')
    expect(screen.queryByLabelText('Who is teaching?')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Date')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enter classroom' }))
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/class/new-class?start=true'))
    const post = mockFetch.mock.calls.find((call) => call[1]?.method === 'POST')
    expect(post?.[0]).toMatch(/\/live-classes\/start-now$/)
    expect(JSON.parse(post?.[1]?.body as string)).toMatchObject({
      course_id: 'course-1', tutor_id: 'tutor-1', title: 'Mathematics class', duration_minutes: 60,
    })
  })

  it('schedules later with generated title and automatic sole-tutor assignment', async () => {
    const user = userEvent.setup()
    render(<ScheduleClient {...adminProps} />)
    await screen.findByRole('heading', { name: 'No classes scheduled yet' })

    await user.click(screen.getByRole('button', { name: /^Schedule$/i }))
    await user.selectOptions(screen.getByLabelText('What are you teaching?'), 'course-1')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Schedule class' })).toBeEnabled())
    expect(screen.queryByLabelText('Who is teaching?')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2030-01-01' } })
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '14:30' } })

    await user.click(screen.getByRole('button', { name: 'Schedule class' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Class scheduled'))
    const post = mockFetch.mock.calls.find((call) => call[1]?.method === 'POST')
    const body = JSON.parse(post?.[1]?.body as string)
    expect(post?.[0]).toMatch(/\/live-classes$/)
    expect(body).toMatchObject({ course_id: 'course-1', tutor_id: 'tutor-2', title: 'Mathematics class', duration_minutes: 60 })
    expect(new Date(body.scheduled_at).toISOString()).toBeDefined()
  })

  it('keeps title and duration behind optional details', async () => {
    const user = userEvent.setup()
    render(<ScheduleClient {...tutorProps} />)
    await screen.findByRole('heading', { name: 'No classes scheduled yet' })
    await user.click(screen.getByRole('button', { name: /Start now/i }))

    expect(screen.getByLabelText('Class title')).not.toBeVisible()
    await user.click(screen.getByText(/Edit title or duration/i))
    expect(screen.getByLabelText('Class title')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '1h' })).toBeChecked()
  })
})
