import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgrammesClient } from '../programmes/programmes-client'
import { ClassBuilder } from './class-builder'
import { AddClassSubjectClient } from './add-class-subject-client'

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

function withQuery(children: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>)
}

describe('Class vertical recovery states', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('keeps the Class list failure distinct from the successful empty state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ error: 'temporary outage' }, 503)))
    withQuery(<ProgrammesClient />)
    expect(await screen.findByText('We could not load your classes.')).toBeTruthy()
    expect(screen.queryByText('Create your first class')).toBeNull()
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
})
