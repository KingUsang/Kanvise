import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgrammesClient } from '../programmes/programmes-client'
import { ClassBuilder } from './class-builder'
import { AddClassSubjectClient } from './add-class-subject-client'
import { classQueryKeys } from '@/lib/class-query-keys'

vi.mock('next/link', () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))
vi.mock('@/lib/authenticated-fetch', () => ({
  authenticatedApiFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'token' } } })) } }),
}))
vi.mock('@/lib/dashboard-session', () => ({
  dashboardQueryKeys: { summary: ['dashboard-summary'], schedule: ['dashboard-schedule'], timetable: ['dashboard-timetable'] },
  useDashboardSession: () => ({ isPending: false, isError: true, data: undefined, refetch: vi.fn() }),
}))

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function withQuery(children: React.ReactNode, queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>)
  return queryClient
}

describe('Class vertical recovery states', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/dashboard/classes')
  })

  it('keeps the Class list failure distinct from the successful empty state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ error: 'temporary outage' }, 503)))
    withQuery(<ProgrammesClient />)
    expect(await screen.findByText('We could not load your classes.')).toBeTruthy()
    expect(screen.queryByText('Create your first class')).toBeNull()
  })

  it('keeps the initial loading state separate from the successful empty state', async () => {
    const resolvers: Array<(value: Response) => void> = []
    vi.stubGlobal('fetch', vi.fn((input: string) => new Promise<Response>((resolve) => {
      resolvers.push((value) => resolve(value))
      void input
    })))

    withQuery(<ProgrammesClient />)
    expect(await screen.findByRole('status', { name: 'Loading classes' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Create your first class')).toBeNull()

    resolvers[0](response({ data: [] }))
    resolvers[1](response({ data: { id: 'school-1', slug: 'school' } }))
    resolvers[2](response({ user: { id: 'user-1', role: 'admin' } }))
    expect(await screen.findByRole('heading', { name: 'Create your first class' })).toBeInTheDocument()
  })

  it('uses the canonical collection toolbar for search, status, count and creation', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.endsWith('/classes')) return response({ data: [
        { id: 'class-1', name: 'Physics', slug: 'physics', description: null, price: 0, is_published: true, courses: [], courses_count: 0, assigned_subjects_count: 0, tutors_complete: true },
        { id: 'class-2', name: 'Math', slug: 'math', description: null, price: 0, is_published: false, courses: [], courses_count: 0, assigned_subjects_count: 0, tutors_complete: true },
      ] })
      if (input.endsWith('/schools/me')) return response({ data: { id: 'school-1', slug: 'school' } })
      if (input.endsWith('/auth/me')) return response({ user: { id: 'user-1', role: 'admin' } })
      throw new Error(`Unexpected request ${input}`)
    }))

    withQuery(<ProgrammesClient />)

    const toolbar = await screen.findByRole('toolbar', { name: 'Class collection controls' })
    expect(screen.getByRole('searchbox', { name: 'Search classes' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filter classes by status' })).toBeInTheDocument()
    expect(within(toolbar).getByRole('status')).toHaveTextContent('2 classes')
    expect(within(toolbar).getByRole('link', { name: 'Create class' })).toHaveAttribute('href', '/dashboard/classes/new')
    expect(within(toolbar).getByRole('link', { name: 'Create class' })).toHaveClass('min-h-11', 'w-full', 'sm:w-auto')
  })

  it('keeps URL-backed filters and no-results separate from the initial empty state', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.endsWith('/classes')) return response({ data: [
        { id: 'class-1', name: 'Physics', slug: 'physics', description: null, price: 0, is_published: true, courses: [], courses_count: 0, assigned_subjects_count: 0, tutors_complete: true },
      ] })
      if (input.endsWith('/schools/me')) return response({ data: { id: 'school-1', slug: 'school' } })
      if (input.endsWith('/auth/me')) return response({ user: { id: 'user-1', role: 'admin' } })
      throw new Error(`Unexpected request ${input}`)
    }))

    withQuery(<ProgrammesClient />)
    const search = await screen.findByRole('searchbox', { name: 'Search classes' })

    fireEvent.change(search, { target: { value: 'biology' } })

    expect(new URL(window.location.href).searchParams.get('search')).toBe('biology')
    expect(await screen.findByRole('heading', { name: 'No classes match' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Create your first class' })).toBeNull()
  })

  it('does not leave Add Subject on an indefinite preparation spinner after session failure', () => {
    withQuery(<AddClassSubjectClient classId="class-1" />)
    expect(screen.getByText('We could not verify your access to add a subject.')).toBeTruthy()
    expect(screen.queryByText('Preparing subject setup…')).toBeNull()
  })

  it('keeps prerequisite failure recoverable before rendering a blank Class form', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ error: 'temporary outage' }, 503)))
    withQuery(<ClassBuilder />)
    expect(await screen.findByText('We could not load the class prerequisites')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('keeps cached Class-list data visible after a failed background refetch', async () => {
    let failRefresh = false
    vi.stubGlobal('fetch', vi.fn(async () => failRefresh ? response({ error: 'temporary outage' }, 503) : response({ data: [] })))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(classQueryKeys.programmes(null), {
      programmes: [{ id: 'class-1', name: 'Cached class', slug: 'cached-class', description: null, price: 0, is_published: true, courses: [], courses_count: 0, assigned_subjects_count: 0, tutors_complete: true }],
      schoolSlug: 'centre', schoolId: 'school-1', userId: 'user-1', canCreate: true, schoolContextError: false,
    })
    withQuery(<ProgrammesClient />, queryClient)
    expect(await screen.findByRole('heading', { name: 'Cached class' })).toBeTruthy()

    failRefresh = true
    await queryClient.refetchQueries({ queryKey: classQueryKeys.programmes(null), exact: true })
    const notice = (await screen.findByText('Class refresh failed; showing your last saved classes.')).closest('[role="status"]')
    expect(notice).not.toBeNull()
    expect(notice!).toHaveTextContent('Class refresh failed')
    expect(notice).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('heading', { name: 'Cached class' })).toBeTruthy()
  })
})
