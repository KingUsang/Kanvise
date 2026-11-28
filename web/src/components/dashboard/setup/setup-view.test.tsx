import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSetupChecklist, type SetupFacts } from '@/lib/setup-checklist'
import { SetupView } from './setup-view'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/dashboard/setup' }))

const none: SetupFacts = { students: 0, courses: 0, lessons: 0, tutors: 0 }
afterEach(cleanup)

function view(facts: SetupFacts, props: Partial<Parameters<typeof SetupView>[0]> = {}, skippedSteps: string[] = []) {
  const onToggleSkip = vi.fn()
  const onFinish = vi.fn()
  const onDismissBanner = vi.fn()
  render(
    <SetupView
      firstName="Michael"
      checklist={buildSetupChecklist({ accountType: 'independent', facts, skippedSteps, shippedStep: 5 })}
      showDefaultsBanner={false}
      onDismissBanner={onDismissBanner}
      onToggleSkip={onToggleSkip}
      busyStep={null}
      onFinish={onFinish}
      {...props}
    />,
  )
  return { onToggleSkip, onFinish, onDismissBanner }
}

describe('SetupView', () => {
  it('greets by name and reads {n}/{rows shown} completed', () => {
    view({ ...none, students: 1 })
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Welcome to Kanvise, Michael')
    expect(screen.getByText('1/5 completed')).toBeTruthy()
    expect(screen.getAllByRole('listitem').filter((item) => item.getAttribute('data-state'))).toHaveLength(5)
  })

  it('marks one Next row, ticks finished rows with a View link', () => {
    view({ ...none, students: 1 })
    expect(screen.getAllByText('Next')).toHaveLength(1)
    const done = document.querySelector('[data-state="done"]') as HTMLElement
    expect(within(done).getByRole('link', { name: /View/ })).toBeTruthy()
    expect(within(done).queryByText('Next')).toBeNull()
  })

  it('shows why a button is disabled as text', () => {
    view({ ...none, students: 1 })
    expect(screen.getAllByText('Create a course first.')).toHaveLength(2)
    expect((screen.getAllByRole('button', { name: 'Build plan' })[0] as HTMLButtonElement).disabled).toBe(true)
  })

  it('skips and undoes the course plan step only', () => {
    const { onToggleSkip } = view({ ...none, courses: 1 })
    expect(screen.getAllByRole('button', { name: 'Skip this step' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Skip this step' }))
    expect(onToggleSkip).toHaveBeenCalledWith('course_plan', true)
    cleanup()
    const undo = view({ ...none, courses: 1 }, {}, ['course_plan'])
    expect(screen.getByText('Skipped')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Do this step' }))
    expect(undo.onToggleSkip).toHaveBeenCalledWith('course_plan', false)
  })

  it('shows the all done card when every row is done or skipped (SET-03)', () => {
    const checklist = buildSetupChecklist({ accountType: 'independent', facts: { students: 1, courses: 1, lessons: 1, tutors: 0 }, skippedSteps: ['course_plan'], shippedStep: 4 })
    const { onFinish } = view(none, { checklist, firstName: '' })
    expect(screen.getByText("You're all set.")).toBeTruthy()
    expect(screen.queryByText(/completed/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Go to dashboard' }))
    expect(onFinish).toHaveBeenCalled()
  })

  it('shows the defaults banner as persistent info with a dismiss button, not a toast', () => {
    const { onDismissBanner } = view(none, { showDefaultsBanner: true })
    expect(screen.getByRole('status').textContent).toContain('We used the default settings.')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismissBanner).toHaveBeenCalled()
  })

  it('hides the help card without a help URL and never shows the sample course card', () => {
    view(none)
    expect(screen.queryByText('Get started with confidence')).toBeNull()
    expect(screen.queryByText(/sample course/i)).toBeNull()
    cleanup()
    view(none, { helpUrl: 'https://help.example.com' })
    expect(screen.getByRole('link', { name: /Visit the help guide/ }).getAttribute('href')).toBe('https://help.example.com')
    expect(screen.queryByText(/Explore the sample course/i)).toBeNull()
  })
})
