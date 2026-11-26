import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockAttemptClient } from './mock-attempt-client'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}))

vi.mock('@/config/api', () => ({
  getApiUrl: () => 'https://staging-api.kanvise.com',
}))
vi.mock('@/lib/authenticated-fetch', () => ({
  authenticatedApiFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}))

vi.mock('@/components/navigation/NavigationProgress', () => ({
  startNavigationProgress: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const data = {
  server_now: '2026-08-10T10:00:01.000Z',
  attempt: { id: 'attempt-1', deadline_at: '2026-08-10T10:00:00.000Z' },
  mock: { title: 'JAMB Mock', calculator_mode: 'none' as const },
  questions: [{
    id: 'question-1', section_title: 'Mathematics', marks: 1, question_type: 'mcq' as const,
    plain_text: 'What is 2 + 2?', content_blocks: [] as never[], stimulus: null,
    options: [
      { id: 'option-1', plain_text: '3', content_blocks: [] as never[] },
      { id: 'option-2', plain_text: '4', content_blocks: [] as never[] },
    ],
  }],
  answers: [],
}

describe('MockAttemptClient timeout', () => {
  beforeEach(() => {
    replace.mockReset()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { status: 'timed_out' } }),
    }))
  })

  it('locks answers and finalizes directly after the deadline', async () => {
    render(<MockAttemptClient data={data} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Time is up')
    expect(screen.getByRole('button', { name: 'Flag' })).toBeDisabled()
    for (const option of screen.getAllByRole('radio')) expect(option).toBeDisabled()
    expect(screen.getByRole('button', { name: 'End of quiz' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /review and submit/i })).not.toBeInTheDocument()

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(fetch).toHaveBeenCalledWith(
      'https://staging-api.kanvise.com/attempts/attempt-1/submit',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('groups a multi-subject mock into subject navigation and local question numbers', () => {
    render(<MockAttemptClient data={{
      ...data,
      attempt: { id: 'attempt-2', deadline_at: null },
      questions: [
        { ...data.questions[0], id: 'english-1', section_title: 'Use of English' },
        { ...data.questions[0], id: 'physics-1', section_title: 'Physics', plain_text: 'What is velocity?' },
        { ...data.questions[0], id: 'physics-2', section_title: 'Physics', plain_text: 'What is acceleration?' },
      ],
    }} />)

    expect(screen.getByRole('navigation', { name: 'Quiz subjects' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Physics/ }))
    expect(screen.getByText('Physics · Question 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Physics question 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Physics question 2' })).toBeInTheDocument()
  })

  it('keeps the attempt header pinned to the top and shows no guest notice', () => {
    const { container } = render(<MockAttemptClient data={{
      ...data,
      attempt: { id: 'attempt-1', deadline_at: null },
    }} />)

    expect(screen.queryByText('Guest attempt.')).not.toBeInTheDocument()
    expect(container.querySelector('header')).toHaveClass('sticky', 'top-0')
  })
})

describe('MockAttemptClient answer saving', () => {
  const live = {
    ...data,
    server_now: '2026-08-10T09:00:00.000Z',
    attempt: { id: 'attempt-9', deadline_at: null, student_id: 'learner-9' },
  }

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ data: {} }) }))
  })

  it('sends the newest answer and flag together, one request at a time', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const bodies: Array<Record<string, unknown>> = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight)
      bodies.push(JSON.parse(String(init.body)))
      await new Promise(resolve => setTimeout(resolve, 5))
      inFlight -= 1
      return { ok: true, json: async () => ({ data: {} }) }
    }))
    render(<MockAttemptClient data={live} />)

    fireEvent.click(screen.getByLabelText(/4/))
    fireEvent.click(screen.getByRole('button', { name: /Flag/ }))

    await waitFor(() => expect(bodies.at(-1)).toMatchObject({ selected_option_version_id: 'option-2', is_flagged: true }))
    expect(maxInFlight).toBe(1)
  })

  it('stores unsaved work under a key bound to the learner and clears it after saving', async () => {
    render(<MockAttemptClient data={live} />)
    fireEvent.click(screen.getByLabelText(/4/))
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
    expect(Object.keys(localStorage).filter(key => key.includes('learner-9'))).toEqual([])
  })

  it('keeps queued work, bound to the learner, when the save fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'boom' }) }))
    render(<MockAttemptClient data={live} />)
    fireEvent.click(screen.getByLabelText(/4/))
    await waitFor(() => expect(Object.keys(localStorage).some(key => key.startsWith('kanvise-attempt:v2:learner-9:attempt-9:'))).toBe(true))
  })

  it('removes legacy unbound entries when an attempt opens', () => {
    localStorage.setItem('kanvise-attempt-attempt-1-question-1', '{"selected_option_version_id":"option-1"}')
    render(<MockAttemptClient data={live} />)
    expect(localStorage.getItem('kanvise-attempt-attempt-1-question-1')).toBeNull()
  })
})
