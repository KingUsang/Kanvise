import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetupState } from '@/lib/setup-checklist'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }), usePathname: () => '/dashboard/setup' }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }))
vi.mock('@/lib/account-preference', () => ({ useActiveAccountId: () => 'account-1' }))
vi.mock('@/lib/dashboard-session', () => ({ useDashboardSession: () => ({ data: { user: { first_name: 'Michael' } } }) }))

const mocks = vi.hoisted(() => ({ setup: {} as unknown, onboarding: {} as unknown, shipped: 2 }))
vi.mock('@/lib/onboarding-api', () => ({
  onboardingQueryKeys: { setup: ['s'], state: ['o'] },
  setStepSkipped: vi.fn(),
  useSetupState: () => mocks.setup,
  useOnboardingState: () => mocks.onboarding,
}))
vi.mock('@/lib/setup-checklist', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/setup-checklist')>()
  return { ...actual, buildSetupChecklist: (input: Parameters<typeof actual.buildSetupChecklist>[0]) => actual.buildSetupChecklist({ ...input, shippedStep: mocks.shipped }) }
})

import { SetupPageClient } from './setup-page-client'

const owner = (facts: Partial<Extract<SetupState, { eligible: true }>['facts']> = {}): SetupState => ({
  eligible: true, accountType: 'independent', skippedSteps: [], hasStudentsAnswer: false,
  facts: { students: 0, courses: 0, lessons: 0, tutors: 0, ...facts },
})

function load(data: SetupState, onboarding: unknown = { data: null }) {
  mocks.setup = { isSuccess: true, isError: false, data }
  mocks.onboarding = onboarding
}

describe('SetupPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    mocks.shipped = 2
  })
  afterEach(cleanup)

  it('goes to the dashboard when no row has shipped, instead of an empty checklist', async () => {
    load(owner())
    render(<SetupPageClient />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
  })

  it('goes to the dashboard for someone with no checklist (invited staff)', async () => {
    load({ eligible: false })
    render(<SetupPageClient />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows the checklist with {n}/{rows shown} once rows have shipped', () => {
    mocks.shipped = 3
    load(owner({ students: 0 }))
    render(<SetupPageClient />)
    expect(screen.getByText('0/1 completed')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Welcome to Kanvise, Michael')
    expect(replace).not.toHaveBeenCalled()
  })

  it('shows the all set screen once, then redirects on later visits (SET-03)', async () => {
    mocks.shipped = 3
    load(owner({ students: 3 }))
    const first = render(<SetupPageClient />)
    expect(screen.getByText("You're all set.")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Go to dashboard' }))
    expect(replace).toHaveBeenCalledWith('/dashboard')
    first.unmount()
    replace.mockClear()
    render(<SetupPageClient />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows the defaults banner until it is dismissed', () => {
    mocks.shipped = 3
    load(owner(), { data: { answers: { used_defaults: true } } })
    render(<SetupPageClient />)
    expect(screen.getByText('We used the default settings.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('We used the default settings.')).toBeNull()
  })
})
