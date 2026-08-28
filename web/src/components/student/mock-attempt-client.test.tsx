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
    render(<MockAttemptClient data={data} token="token" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Time is up')
    expect(screen.getByRole('button', { name: 'Flag' })).toBeDisabled()
    for (const option of screen.getAllByRole('radio')) expect(option).toBeDisabled()
    expect(screen.getByRole('button', { name: 'End of mock' })).toBeDisabled()
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
    }} token="token" />)

    expect(screen.getByRole('navigation', { name: 'Mock subjects' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Physics/ }))
    expect(screen.getByText('Physics · Question 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Physics question 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Physics question 2' })).toBeInTheDocument()
  })
})
