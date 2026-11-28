import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }))
const saveOnboarding = vi.fn()
vi.mock('@/lib/onboarding-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/onboarding-api')>()),
  saveOnboarding: (payload: Record<string, unknown>) => saveOnboarding(payload),
}))

import { OnboardingExperience } from './onboarding-experience'

function setMotion({ reduced = false, saveData = false } = {}) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  Object.defineProperty(navigator, 'connection', { value: { saveData }, configurable: true })
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><OnboardingExperience firstName="Michael" /></QueryClientProvider>)
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('OnboardingExperience with plain text (reduced motion)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMotion({ reduced: true })
    saveOnboarding.mockResolvedValue({ usedDefaults: false })
  })
  afterEach(cleanup)

  it('shows Kavi lines at once with no typing indicator or wave (ONB-01)', () => {
    mount()
    expect(screen.getByText("Hi Michael, I'm Kavi.")).toBeTruthy()
    expect(screen.queryByTestId('kavi-typing')).toBeNull()
    expect(document.querySelector('.animate-dashboard-wave')).toBeNull()
    expect(screen.getByRole('button', { name: "Let's go" })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Answer as a form instead' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Skip setup' })).toBeTruthy()
  })

  it('saves an independent tutor\'s answers and opens setup (ONB-02 to ONB-08)', async () => {
    mount()
    click("Let's go")
    expect(screen.getByText('Do you teach on your own or with a team?')).toBeTruthy()
    click('On my own')
    expect(screen.getByText("Okay. I'll leave out the team features for now.")).toBeTruthy()
    click('Children and teens')
    click('Small groups')
    fireEvent.click(screen.getByRole('button', { name: 'Mathematics' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    click('Not yet')
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/setup'))
    expect(saveOnboarding).toHaveBeenCalledWith({
      teaching_mode: 'solo', audience: 'children_teens', class_format: 'small_groups', subjects: ['Mathematics'], has_students: false,
    })
  })

  it('asks a team for the agency name and validates it (ONB-07)', async () => {
    mount()
    click("Let's go")
    click('With a team')
    click('Adults')
    click('One-to-one')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    click('Yes, I have students')
    expect(screen.getByText("What's your agency called?")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('alert').textContent).toBe("Add your agency's name.")
    expect(saveOnboarding).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Agency name'), { target: { value: 'Science Students Academy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/setup'))
    expect(saveOnboarding).toHaveBeenCalledWith({
      teaching_mode: 'team', audience: 'adults', class_format: 'one_to_one', subjects: [], has_students: true, agency_name: 'Science Students Academy',
    })
  })

  it('applies the defaults from Skip setup (ONB-09)', async () => {
    mount()
    click('Skip setup')
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/setup'))
    expect(saveOnboarding).toHaveBeenCalledWith({ use_defaults: true })
  })

  it('lets someone skip a question and go back with the answer kept', () => {
    mount()
    click("Let's go")
    click('With a team')
    click('Skip this question')
    expect(screen.getByText('How do you usually teach?')).toBeTruthy()
    click('Back')
    click('Back')
    expect(screen.getByText('Do you teach on your own or with a team?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'With a team' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps the answers and offers Try again or defaults when saving fails (ONB-08)', async () => {
    saveOnboarding.mockRejectedValueOnce(new Error('down'))
    mount()
    click("Let's go")
    click('On my own')
    click('Both')
    click('Both')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    click('Not yet')
    expect((await screen.findByRole('alert')).textContent).toBe("We couldn't save your answers. Your choices are still here.")
    expect(replace).not.toHaveBeenCalled()
    click('Try again')
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/setup'))
    expect(saveOnboarding).toHaveBeenCalledTimes(2)
    expect(saveOnboarding.mock.calls[1][0]).toEqual(saveOnboarding.mock.calls[0][0])
  })

  it('continues with defaults after a failed save', async () => {
    saveOnboarding.mockRejectedValueOnce(new Error('down'))
    mount()
    click("Let's go")
    for (const label of ['On my own', 'Both', 'Both']) click(label)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    click('Not yet')
    await screen.findByRole('alert')
    click('Continue with defaults')
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/setup'))
    expect(saveOnboarding).toHaveBeenLastCalledWith({ use_defaults: true })
  })

  it('answers as a plain form with the same questions (ONB-11)', async () => {
    mount()
    click('Answer as a form instead')
    expect(screen.getByRole('heading', { name: 'A few questions' })).toBeTruthy()
    for (const question of ['Do you teach on your own or with a team?', 'Who do you mostly teach?', 'How do you usually teach?', 'What do you teach?', 'Do you already have students?']) {
      expect(screen.getByText(question)).toBeTruthy()
    }
    expect(screen.queryByLabelText('Agency name')).toBeNull()
    fireEvent.click(screen.getByLabelText('With a team'))
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    expect(screen.getByRole('alert').textContent).toBe("Add your agency's name.")
    fireEvent.change(screen.getByLabelText('Agency name'), { target: { value: 'Maple Tutors' } })
    fireEvent.click(screen.getByLabelText('Adults'))
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/setup'))
    // Unanswered questions are left out so the API uses the defaults.
    expect(saveOnboarding).toHaveBeenCalledWith({ teaching_mode: 'team', audience: 'adults', agency_name: 'Maple Tutors' })
  })

  it('also shows plain text when the browser asks to save data', () => {
    setMotion({ saveData: true })
    mount()
    expect(screen.queryByTestId('kavi-typing')).toBeNull()
    expect(screen.getByText("Hi Michael, I'm Kavi.")).toBeTruthy()
  })
})

describe('OnboardingExperience with motion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    setMotion()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows the typing indicator for 0.4s, then types the line in under a second (ONB-01)', () => {
    mount()
    expect(screen.getByTestId('kavi-typing')).toBeTruthy()
    expect(screen.queryByText(/Hi Michael/)).toBeNull()
    act(() => { vi.advanceTimersByTime(450) })
    expect(screen.queryByTestId('kavi-typing')).toBeNull()
    act(() => { vi.advanceTimersByTime(1100) })
    expect(screen.getAllByText("Hi Michael, I'm Kavi.").length).toBeGreaterThan(0)
    // The second line follows once the first has fully appeared.
    expect(screen.getByTestId('kavi-typing')).toBeTruthy()
  })

  it('shows the rest of a line at once when a key is pressed', () => {
    mount()
    act(() => { vi.advanceTimersByTime(450) })
    act(() => { fireEvent.keyDown(window, { key: 'a' }) })
    expect(screen.getAllByText("Hi Michael, I'm Kavi.").length).toBeGreaterThan(0)
  })

  it('announces a line once, when it is complete, and hides the partial text', () => {
    mount()
    act(() => { vi.advanceTimersByTime(450) })
    const partial = document.querySelector('p[aria-live="polite"] span[aria-hidden="true"]')
    expect(partial).toBeTruthy()
    expect(document.querySelector('p[aria-live="polite"] .sr-only')).toBeNull()
    act(() => { vi.advanceTimersByTime(1100) })
    expect(document.querySelector('p[aria-live="polite"] .sr-only')?.textContent).toBe("Hi Michael, I'm Kavi.")
  })
})
