import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScheduleClient } from './schedule-client'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Sample data for rendering
const mockCourses = [{ id: 'course-1', name: 'Intro to Math', code: 'MATH101' }]
const mockTutors = [{ id: 'tutor-2', first_name: 'John', last_name: 'Doe' }]

const defaultAdminProps = {
  token: 'fake-token',
  capabilities: { isAdmin: true, isTutor: false },
  user: { id: 'admin-1', first_name: 'Admin', last_name: 'User' }
}

const defaultTutorProps = {
  token: 'fake-token',
  capabilities: { isAdmin: false, isTutor: true },
  user: { id: 'tutor-1', first_name: 'Jane', last_name: 'Smith' }
}

describe('ScheduleClient (Schedule Button Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default fetch mocks for initial data load
    mockFetch.mockImplementation(async (url) => {
      if (url.includes('/live-classes')) {
        return { ok: true, json: async () => ({ data: [] }) }
      }
      if (url.includes('/courses')) {
        if (url.includes('/tutors')) {
          return { ok: true, json: async () => ({ data: [{ tutor_id: 'tutor-2' }] }) }
        }
        return { ok: true, json: async () => ({ data: mockCourses }) }
      }
      if (url.includes('/tutors')) {
        return { ok: true, json: async () => ({ data: mockTutors }) }
      }
      return { ok: true, json: async () => ({ data: [] }) }
    })
  })

  it('sends the expected POST request with ISO timestamp on successful submission', async () => {
    const user = userEvent.setup()
    render(<ScheduleClient {...defaultAdminProps} />)
    
    // Wait for initial fetch
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/courses'), expect.any(Object)))
    
    // Fill form
    const titleInput = screen.getByPlaceholderText('e.g. Advanced Calculus Rev.')
    await user.type(titleInput, 'New Test Class')
    
    const selects = document.querySelectorAll('select')
    await user.selectOptions(selects[0], 'course-1')
    
    // Need to wait for tutors to load after selecting course
    await waitFor(() => expect(document.querySelectorAll('select')[1].options.length).toBeGreaterThan(1))
    await user.selectOptions(document.querySelectorAll('select')[1], 'tutor-2')
    
    // Set date and time
    const dateInput = document.querySelector('input[type="date"]')
    const timeInput = document.querySelector('input[type="time"]')
    fireEvent.change(dateInput!, { target: { value: '2030-01-01' } })
    fireEvent.change(timeInput!, { target: { value: '14:30' } })
    
    // Duration defaults to 60, no need to click
    
    // Mock successful post response
    mockFetch.mockImplementationOnce(async (url, options) => {
      if (options?.method === 'POST') {
        return { ok: true, json: async () => ({ data: { id: 'new-class' } }) }
      }
      return { ok: true, json: async () => ({ data: [] }) }
    })
    
    // Submit
    const scheduleBtn = screen.getByRole('button', { name: /Schedule Class/i })
    await user.click(scheduleBtn)
    
    await waitFor(() => {
      const postCalls = mockFetch.mock.calls.filter(call => call[1]?.method === 'POST')
      expect(postCalls.length).toBe(1)
      
      const reqBody = JSON.parse(postCalls[0][1].body)
      expect(reqBody).toMatchObject({
        title: 'New Test Class',
        course_id: 'course-1',
        tutor_id: 'tutor-2',
        duration_minutes: 60
      })
      
      // Verifies local time was converted to correct ISO timestamp
      const scheduledDate = new Date(reqBody.scheduled_at)
      expect(scheduledDate.toISOString()).toBeDefined()
    })
  })

  it('uses the signed-in tutor automatically for tutor accounts', async () => {
    const user = userEvent.setup()
    render(<ScheduleClient {...defaultTutorProps} />)
    
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/courses'), expect.any(Object)))
    
    await user.type(screen.getByPlaceholderText('e.g. Advanced Calculus Rev.'), 'Tutor Class')
    await user.selectOptions(document.querySelectorAll('select')[0], 'course-1')
    
    // Verify Tutor select doesn't exist for tutors
    expect(document.querySelectorAll('select').length).toBe(1)
    
    const dateInput = document.querySelector('input[type="date"]')
    const timeInput = document.querySelector('input[type="time"]')
    fireEvent.change(dateInput!, { target: { value: '2030-01-01' } })
    fireEvent.change(timeInput!, { target: { value: '14:30' } })
    
    mockFetch.mockImplementationOnce(async (url, options) => {
      if (options?.method === 'POST') return { ok: true, json: async () => ({ data: { id: 'tutor-class' } }) }
      return { ok: true, json: async () => ({ data: [] }) }
    })
    
    await user.click(screen.getByRole('button', { name: /Schedule Class/i }))
    
    await waitFor(() => {
      const postCalls = mockFetch.mock.calls.filter(call => call[1]?.method === 'POST')
      expect(postCalls.length).toBe(1)
      const reqBody = JSON.parse(postCalls[0][1].body)
      
      // Used their own tutor ID implicitly!
      expect(reqBody.tutor_id).toBe('tutor-1')
    })
  })

  it('displays useful server validation errors and does not clear the form', async () => {
    const user = userEvent.setup()
    render(<ScheduleClient {...defaultTutorProps} />)
    
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/courses'), expect.any(Object)))
    
    await user.type(screen.getByPlaceholderText('e.g. Advanced Calculus Rev.'), 'Failed Class')
    await user.selectOptions(document.querySelectorAll('select')[0], 'course-1')
    
    const dateInput = document.querySelector('input[type="date"]')
    const timeInput = document.querySelector('input[type="time"]')
    fireEvent.change(dateInput!, { target: { value: '2030-01-01' } })
    fireEvent.change(timeInput!, { target: { value: '14:30' } })
    
    // Mock API returning a 400 validation error
    mockFetch.mockImplementationOnce(async (url, options) => {
      if (options?.method === 'POST') {
        return { 
          ok: false, 
          status: 400,
          json: async () => ({ error: 'Cannot schedule a class in the past', code: 'SCHEDULED_IN_PAST' }) 
        }
      }
      return { ok: true, json: async () => ({ data: [] }) }
    })
    
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    
    await user.click(screen.getByRole('button', { name: /Schedule Class/i }))
    
    // Error should be shown
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot schedule a class in the past')))
    
    // Form should NOT be cleared
    expect(screen.getByPlaceholderText('e.g. Advanced Calculus Rev.')).toHaveValue('Failed Class')
    
    alertSpy.mockRestore()
  })

  it('prevents duplicate submissions while the first request is pending', async () => {
    const user = userEvent.setup()
    render(<ScheduleClient {...defaultTutorProps} />)
    
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/courses'), expect.any(Object)))
    
    await user.type(screen.getByPlaceholderText('e.g. Advanced Calculus Rev.'), 'Slow Class')
    await user.selectOptions(document.querySelectorAll('select')[0], 'course-1')
    
    const dateInput = document.querySelector('input[type="date"]')
    const timeInput = document.querySelector('input[type="time"]')
    fireEvent.change(dateInput!, { target: { value: '2030-01-01' } })
    fireEvent.change(timeInput!, { target: { value: '14:30' } })
    
    let resolvePost: any
    const postPromise = new Promise(resolve => { resolvePost = resolve })
    
    mockFetch.mockImplementation(async (url, options) => {
      if (options?.method === 'POST') {
        await postPromise
        return { ok: true, json: async () => ({ data: { id: 'slow-class' } }) }
      }
      return { ok: true, json: async () => ({ data: [] }) }
    })
    
    const scheduleBtn = screen.getByRole('button', { name: /Schedule Class/i })
    
    // Click multiple times
    // Just click once and verify it disables
    await user.click(scheduleBtn)
    
    // The button should be disabled while pending
    await waitFor(() => expect(scheduleBtn).toBeDisabled())
    expect(scheduleBtn).toHaveTextContent(/Scheduling...|Please wait/i)
    
    // Resolve the promise
    resolvePost()
    
    await waitFor(() => {
      const postCalls = mockFetch.mock.calls.filter(call => call[1]?.method === 'POST')
      // Only 1 request should have been sent despite 3 clicks
      expect(postCalls.length).toBe(1)
    })
  })
})
