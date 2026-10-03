import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassWorkspaceClient } from './class-workspace-client'

vi.mock('next/link', () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function renderWorkspace() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><ClassWorkspaceClient classId="class-1" token="test-token" /></QueryClientProvider>)
}

describe('ClassWorkspaceClient data loading', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('loads the class-first workspace and exposes contextual subject chips', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      requests.push(input)
      if (input.endsWith('/classes/class-1')) return response({ data: {
        id: 'class-1', name: 'JAMB 2027', is_published: false, enrolled_count: 2,
        courses: [{ id: 'physics', name: 'Physics' }, { id: 'chemistry', name: 'Chemistry' }],
      } })
      if (input.endsWith('/classes/class-1/schedule')) return response({ data: { sessions: [] } })
      if (input.endsWith('/mocks')) return response({ data: [] })
      if (input.includes('/assignments')) return response({ data: [] })
      if (input.endsWith('/classes/class-1/insights')) return response({ data: { learners: [], class_health: { average_assessment_score: null, attendance: null, needs_attention: 0 } } })
      if (input.endsWith('/notes/physics') || input.endsWith('/notes/chemistry')) return response({ data: [] })
      throw new Error(`Unexpected request ${input}`)
    }))

    renderWorkspace()

    expect(await screen.findByRole('heading', { name: 'JAMB 2027' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'All subjects' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Physics' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Chemistry' })).toBeTruthy()
    await waitFor(() => expect(requests).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/classes\/class-1$/),
      expect.stringMatching(/\/classes\/class-1\/schedule$/),
      expect.stringMatching(/\/classes\/class-1\/insights$/),
    ])))
  })

  it('opens class-scoped learner evidence instead of redirecting to the global roster', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      requests.push(input)
      if (input.endsWith('/classes/class-1')) return response({ data: { id: 'class-1', name: 'JAMB 2027', is_published: true, enrolled_count: 1, courses: [{ id: 'physics', name: 'Physics' }] } })
      if (input.endsWith('/classes/class-1/schedule')) return response({ data: { sessions: [] } })
      if (input.endsWith('/mocks') || input.includes('/assignments')) return response({ data: [] })
      if (input.includes('learner_id=learner-1')) return response({ data: { learner_detail: {
        id: 'learner-1', name: 'Emeka Okoro', latest_result: 42, previous_score: 58, trend: 'down', attended: 2, scheduled_sessions: 3,
        attendance_rate: 67, last_activity: '2026-10-01T12:00:00Z', attention: 'Needs attention',
        topics: [{ topic: 'Waves', score: 42, questions: 3, state: 'needs_attention' }], assessments: [{ id: 'attempt-1', title: 'Physics Mock 1', score: 42, submitted_at: '2026-10-01T12:00:00Z' }],
        insight_summary: 'Emeka Okoro has marked evidence of difficulty with Waves: 42% across 3 questions.', recommended_action: 'Review Waves in the next session.',
      } } })
      if (input.endsWith('/classes/class-1/insights')) return response({ data: { learners: [{ id: 'learner-1', name: 'Emeka Okoro', latest_result: 42, attended: 2, scheduled_sessions: 3, attendance_rate: 67, last_activity: '2026-10-01T12:00:00Z', attention: 'Needs attention' }], topics: [], class_health: { average_assessment_score: 42, attendance: 67, needs_attention: 1 } } })
      if (input.endsWith('/notes/physics')) return response({ data: [] })
      throw new Error(`Unexpected request ${input}`)
    }))

    const view = renderWorkspace()
    await screen.findAllByRole('link', { name: 'Students' })
    window.history.pushState({}, '', '?tab=learners')
    view.unmount()
    renderWorkspace()
    fireEvent.click(await screen.findByRole('button', { name: /Emeka Okoro/ }))
    expect(await screen.findByRole('dialog', { name: 'Learner evidence' })).toBeTruthy()
    expect(await screen.findByText('Topic mastery')).toBeTruthy()
    expect(screen.getByText('Waves')).toBeTruthy()
    await waitFor(() => expect(requests).toEqual(expect.arrayContaining([expect.stringMatching(/learner_id=learner-1/)])))
  })

  it('uses detailed student evidence, not class aggregates, when a class has one student', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      requests.push(input)
      if (input.endsWith('/classes/class-1')) return response({ data: { id: 'class-1', name: 'Physics coaching', is_published: true, enrolled_count: 1, courses: [{ id: 'physics', name: 'Physics' }] } })
      if (input.endsWith('/classes/class-1/schedule')) return response({ data: { sessions: [] } })
      if (input.endsWith('/mocks') || input.includes('/assignments')) return response({ data: [] })
      if (input.includes('learner_id=learner-1')) return response({ data: { learner_detail: {
        id: 'learner-1', name: 'Journey Student', latest_result: 42, previous_score: 58, trend: 'down', attended: 2, scheduled_sessions: 3,
        attendance_rate: 67, last_activity: '2026-10-01T12:00:00Z', attention: 'Needs attention',
        topics: [{ topic: 'Waves', score: 42, questions: 3, state: 'needs_attention' }], assessments: [{ id: 'attempt-1', title: 'Physics quiz', score: 42, submitted_at: '2026-10-01T12:00:00Z' }],
        insight_summary: 'Journey Student has marked evidence of difficulty with Waves.', recommended_action: 'Review Waves in the next session.',
      } } })
      if (input.endsWith('/classes/class-1/insights')) return response({ data: { learners: [{ id: 'learner-1', name: 'Journey Student', latest_result: 42, attended: 2, scheduled_sessions: 3, attendance_rate: 67, last_activity: '2026-10-01T12:00:00Z', attention: 'Needs attention' }], topics: [], class_health: { average_assessment_score: 42, attendance: 67, needs_attention: 1 } } })
      throw new Error(`Unexpected request ${input}`)
    }))

    window.history.pushState({}, '', '?tab=performance')
    renderWorkspace()

    expect(await screen.findByText('Student performance')).toBeTruthy()
    expect(screen.getByText('Journey Student')).toBeTruthy()
    expect(screen.getByText('Waves')).toBeTruthy()
    expect(screen.getByText('Review Waves in the next session.')).toBeTruthy()
    expect(screen.queryByText('Class health')).toBeNull()
    await waitFor(() => expect(requests).toEqual(expect.arrayContaining([expect.stringMatching(/learner_id=learner-1/)])))
  })
})
