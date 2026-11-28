import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }))
const mocks = vi.hoisted(() => ({ query: {} as unknown }))
vi.mock('@/lib/onboarding-api', () => ({ useOnboardingState: () => mocks.query }))
vi.mock('./onboarding-experience', () => ({ OnboardingExperience: ({ firstName }: { firstName: string }) => <p>Onboarding for {firstName}</p> }))

import { OnboardingGate } from './onboarding-gate'

describe('OnboardingGate', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('shows onboarding to an account owner who has not answered', () => {
    mocks.query = { isSuccess: true, isError: false, data: { needsOnboarding: true } }
    render(<OnboardingGate firstName="Michael" />)
    expect(screen.getByText('Onboarding for Michael')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it('sends invited staff and people who already answered to the dashboard (ONB-10)', async () => {
    mocks.query = { isSuccess: true, isError: false, data: { needsOnboarding: false } }
    render(<OnboardingGate firstName="Michael" />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
    expect(screen.queryByText(/Onboarding for/)).toBeNull()
  })

  it('offers a retry when the state cannot load', () => {
    mocks.query = { isSuccess: false, isError: true, refetch: vi.fn() }
    render(<OnboardingGate firstName="" />)
    expect(screen.getByRole('alert').textContent).toContain("couldn't load")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})
