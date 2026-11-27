import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassWorkspaceClient } from './class-workspace-client'
import { classQueryKeys } from '@/lib/class-query-keys'

vi.mock('next/link', () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))
vi.mock('@/lib/authenticated-fetch', () => ({
  authenticatedApiFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}))

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function renderWorkspace(canManageClass = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><ClassWorkspaceClient classId="class-1" canManageClass={canManageClass} /></QueryClientProvider>)
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

    renderWorkspace(true)

    expect(await screen.findByRole('heading', { name: 'JAMB 2027' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Classes' })).toHaveClass('text-dashboard-muted', 'min-h-11')
    expect(screen.getByRole('link', { name: 'Add subject' })).toHaveClass('bg-dashboard-primary', 'w-full', 'sm:w-auto', 'min-h-11')
    expect(screen.getByRole('button', { name: 'All subjects' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Physics' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Chemistry' })).toBeTruthy()
    for (const label of ['All subjects', 'Physics', 'Chemistry']) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('type', 'button')
      expect(screen.getByRole('button', { name: label })).toHaveClass('min-h-11', 'focus-visible:outline-2')
    }
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
        topics: [{ topic: 'Waves', score: 42, questions: 3, state: 'needs_attention' }], assessments: [{ id: 'attempt-1', title: 'Physics Quiz 1', score: 42, submitted_at: '2026-10-01T12:00:00Z' }],
        insight_summary: 'Emeka Okoro has marked evidence of difficulty with Waves: 42% across 3 questions.', recommended_action: 'Review Waves in the next session.',
      } } })
      if (input.endsWith('/classes/class-1/insights')) return response({ data: { learners: [{ id: 'learner-1', name: 'Emeka Okoro', latest_result: 42, attended: 2, scheduled_sessions: 3, attendance_rate: 67, last_activity: '2026-10-01T12:00:00Z', attention: 'Needs attention' }], topics: [], class_health: { average_assessment_score: 42, attendance: 67, needs_attention: 1 } } })
      if (input.endsWith('/notes/physics')) return response({ data: [] })
      throw new Error(`Unexpected request ${input}`)
    }))

    window.history.pushState({}, '', '?tab=learners')
    renderWorkspace()
    fireEvent.click(await screen.findByRole('button', { name: /Emeka Okoro/ }))
    expect(await screen.findByRole('dialog', { name: 'Learner evidence' })).toBeTruthy()
    expect(await screen.findByText('Topic mastery')).toBeTruthy()
    expect(screen.getByText('Waves')).toBeTruthy()
    await waitFor(() => expect(requests).toEqual(expect.arrayContaining([expect.stringMatching(/learner_id=learner-1/)])))
  })

  it('uses detailed learner evidence, not class aggregates, when a class has one learner', async () => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      requests.push(input)
      if (input.endsWith('/classes/class-1')) return response({ data: { id: 'class-1', name: 'Physics coaching', is_published: true, enrolled_count: 1, courses: [{ id: 'physics', name: 'Physics' }] } })
      if (input.endsWith('/classes/class-1/schedule')) return response({ data: { sessions: [] } })
      if (input.endsWith('/mocks') || input.includes('/assignments')) return response({ data: [] })
      if (input.includes('learner_id=learner-1')) return response({ data: { learner_detail: {
        id: 'learner-1', name: 'Journey Learner', latest_result: 42, previous_score: 58, trend: 'down', attended: 2, scheduled_sessions: 3,
        attendance_rate: 67, last_activity: '2026-10-01T12:00:00Z', attention: 'Needs attention',
        topics: [{ topic: 'Waves', score: 42, questions: 3, state: 'needs_attention' }], assessments: [{ id: 'attempt-1', title: 'Physics quiz', score: 42, submitted_at: '2026-10-01T12:00:00Z' }],
        insight_summary: 'Journey Learner has marked evidence of difficulty with Waves.', recommended_action: 'Review Waves in the next session.',
      } } })
      if (input.endsWith('/classes/class-1/insights')) return response({ data: { learners: [{ id: 'learner-1', name: 'Journey Learner', latest_result: 42, attended: 2, scheduled_sessions: 3, attendance_rate: 67, last_activity: '2026-10-01T12:00:00Z', attention: 'Needs attention' }], topics: [], class_health: { average_assessment_score: 42, attendance: 67, needs_attention: 1 } } })
      throw new Error(`Unexpected request ${input}`)
    }))

    window.history.pushState({}, '', '?tab=performance')
    renderWorkspace()

    expect(await screen.findByText('Learner performance')).toBeTruthy()
    expect(screen.getByText('Journey Learner')).toBeTruthy()
    expect(screen.getByText('Waves')).toBeTruthy()
    expect(screen.getByText('Review Waves in the next session.')).toBeTruthy()
    expect(screen.queryByText('Class health')).toBeNull()
    await waitFor(() => expect(requests).toEqual(expect.arrayContaining([expect.stringMatching(/learner_id=learner-1/)])))
  })

  it('restores a deep-linked Subject and writes chip selection back to browser history', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.endsWith('/classes/class-1')) return response({ data: { id: 'class-1', name: 'Deep link class', is_published: true, enrolled_count: 0, courses: [{ id: 'physics', name: 'Physics' }, { id: 'chemistry', name: 'Chemistry' }] } })
      if (input.endsWith('/classes/class-1/schedule')) return response({ data: { sessions: [] } })
      if (input.endsWith('/mocks') || input.includes('/assignments')) return response({ data: [] })
      if (input.endsWith('/classes/class-1/insights')) return response({ data: { learners: [], topics: [], class_health: { average_assessment_score: null, attendance: null, needs_attention: 0 } } })
      throw new Error(`Unexpected request ${input}`)
    }))
    window.history.pushState({}, '', '?subject=chemistry')

    renderWorkspace()
    await screen.findByRole('heading', { name: 'Deep link class' })
    expect(screen.getByRole('button', { name: 'Chemistry' }).className).toContain('bg-[#2e2877]')
    fireEvent.click(screen.getByRole('button', { name: 'Physics' }))
    expect(new URL(window.location.href).searchParams.get('subject')).toBe('physics')
    fireEvent.click(screen.getByRole('button', { name: 'All subjects' }))
    expect(new URL(window.location.href).searchParams.has('subject')).toBe(false)
  })

  it('does not turn an initial panel failure into an empty workspace', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.endsWith('/classes/class-1')) return response({ data: { id: 'class-1', name: 'Recoverable class', is_published: true, enrolled_count: 0, courses: [{ id: 'physics', name: 'Physics' }] } })
      if (input.endsWith('/classes/class-1/schedule')) return response({ error: 'temporary outage' }, 503)
      if (input.endsWith('/mocks') || input.includes('/assignments')) return response({ data: [] })
      if (input.endsWith('/classes/class-1/insights')) return response({ data: { learners: [], topics: [], class_health: { average_assessment_score: null, attendance: null, needs_attention: 0 } } })
      throw new Error(`Unexpected request ${input}`)
    }))

    renderWorkspace()
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Schedule could not be loaded.')
    expect(notice).toHaveAttribute('aria-live', 'assertive')
    expect(screen.queryByText('No sessions yet')).toBeNull()
  })

  it('keeps the cached root Class workspace visible after a failed refresh', async () => {
    let failRefresh = false
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.endsWith('/classes/class-1')) return failRefresh ? response({ error: 'temporary outage' }, 503) : response({ data: { id: 'class-1', name: 'Cached class', is_published: true, enrolled_count: 0, courses: [{ id: 'physics', name: 'Physics' }] } })
      if (input.endsWith('/classes/class-1/schedule')) return response({ data: { sessions: [] } })
      if (input.endsWith('/mocks') || input.includes('/assignments')) return response({ data: [] })
      if (input.endsWith('/classes/class-1/insights')) return response({ data: { learners: [], topics: [], class_health: { average_assessment_score: null, attendance: null, needs_attention: 0 } } })
      throw new Error(`Unexpected request ${input}`)
    }))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><ClassWorkspaceClient classId="class-1" /></QueryClientProvider>)
    expect(await screen.findByRole('heading', { name: 'Cached class' })).toBeTruthy()

    failRefresh = true
    await queryClient.refetchQueries({ queryKey: classQueryKeys.workspace(null, 'class-1'), exact: true })
    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent('Class workspace could not refresh')
    expect(notice).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('heading', { name: 'Cached class' })).toBeTruthy()
  })
})
