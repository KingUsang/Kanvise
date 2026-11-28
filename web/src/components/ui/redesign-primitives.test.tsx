import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'
import { CountBadge } from './badge'
import { StatusChip } from './status-chip'
import { EntityIcon } from './entity-icon'
import { CourseSwatch } from './course-swatch'
import { Avatar, initialsFor } from './avatar'
import { Tooltip } from './tooltip'
import { Menu } from './menu'
import { AlertDialog, ModalDialog } from './dialog'
import { TabPanel, UnderlineTabLinks, UnderlineTabs } from './tabs'
import { WizardProgress, WizardStep } from './wizard'
import { Pagination, pageCountFor, pageHref } from './pagination'
import { ResponsiveTable } from './data-list'
import { ActiveFilterChips } from './filter-sheet'
import { LiveRegion, SkipLink } from './live-region'
import { TopProgressLine } from './skeleton'
import { EmptyState, ErrorState, StaleDataNotice } from '@/components/dashboard/async-states'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}))

describe('Button disabledReason', () => {
  it('disables the button and links the visible reason with aria-describedby', () => {
    render(<Button disabledReason="You're offline. You can send this when you're back online.">Send</Button>)
    const button = screen.getByRole('button', { name: 'Send' })
    expect(button).toBeDisabled()
    expect(screen.getByText("You're offline. You can send this when you're back online.")).toBeVisible()
    expect(button).toHaveAccessibleDescription("You're offline. You can send this when you're back online.")
  })

  it('renders a plain button without a reason and keeps the press and focus classes', () => {
    render(<Button variant="outline">Cancel</Button>)
    const button = screen.getByRole('button', { name: 'Cancel' })
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('aria-describedby')
    expect(button).toHaveClass('dashboard-press', 'focus-visible:outline-dashboard-focus', 'border')
  })
})

describe('StatusChip and CountBadge', () => {
  it('always renders the status word next to the dot or tick', () => {
    render(<><StatusChip status="planned" /><StatusChip status="starting-soon" /><StatusChip status="live" /><StatusChip status="complete" /></>)
    for (const word of ['Planned', 'Starting soon', 'Live', 'Complete']) expect(screen.getByText(word)).toBeInTheDocument()
    expect(screen.getByText('Live').querySelector('.animate-dashboard-live-pulse')).not.toBeNull()
    expect(screen.getByText('Complete').querySelector('svg')).not.toBeNull()
  })

  it('names a count badge in words and hides it at zero', () => {
    const { container } = render(<><CountBadge count={3} label="3 to mark" /><CountBadge count={0} label="none" /></>)
    expect(screen.getByText('3 to mark')).toHaveClass('sr-only')
    expect(screen.getByText('3')).toHaveAttribute('aria-hidden', 'true')
    expect(container.textContent).not.toContain('none')
  })
})

describe('EntityIcon, CourseSwatch and Avatar', () => {
  it('uses the entity tint and hides decorative icons', () => {
    const { container } = render(<><EntityIcon entity="homework" /><EntityIcon entity="student" label="Student" /></>)
    expect(container.querySelector('[data-entity="homework"]')).toHaveClass('rounded-full', 'bg-dashboard-entity-homework-tint')
    expect(container.querySelector('[data-entity="homework"]')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('img', { name: 'Student' })).toBeInTheDocument()
  })

  it('draws the course swatch as a rounded square, never a circle', () => {
    const { container } = render(<CourseSwatch color="teal" />)
    const swatch = container.querySelector('[data-course-color="teal"]')
    expect(swatch).toHaveClass('bg-dashboard-course-teal')
    expect(swatch).not.toHaveClass('rounded-full')
  })

  it('falls back to initials', () => {
    expect(initialsFor('Alex Thompson')).toBe('AT')
    expect(initialsFor('  ')).toBe('?')
    render(<Avatar name="Science Students Academy" shape="square" decorative={false} />)
    expect(screen.getByRole('img', { name: 'Science Students Academy' })).toHaveTextContent('S')
  })
})

describe('Tooltip', () => {
  it('shows on focus and hover, describes the trigger, and hides on Escape', () => {
    render(<Tooltip content="Lesson starts at 4pm"><button type="button">Info</button></Tooltip>)
    const trigger = screen.getByRole('button', { name: 'Info' })
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible()
    fireEvent.focus(trigger)
    expect(screen.getByRole('tooltip')).toBeVisible()
    expect(trigger).toHaveAccessibleDescription('Lesson starts at 4pm')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible()
    fireEvent.mouseEnter(trigger.parentElement as HTMLElement)
    expect(screen.getByRole('tooltip')).toBeVisible()
  })
})

describe('Menu', () => {
  const items = [
    { label: 'My profile', href: '/profile' },
    { label: 'Duplicate', onSelect: vi.fn() },
    { label: 'Sign out', onSelect: vi.fn(), tone: 'danger' as const },
  ]

  it('follows the menu button pattern with arrow keys and Escape', () => {
    render(<Menu label="Account" trigger="⋯" items={items} />)
    const button = screen.getByRole('button', { name: 'Account' })
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')

    fireEvent.keyDown(button, { key: 'ArrowDown' })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { name: 'Account' })
    const options = screen.getAllByRole('menuitem')
    expect(options[0]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(options[1]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'End' })
    expect(options[2]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(options[0]).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(options[2]).toHaveFocus()

    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(button).toHaveFocus()
  })

  it('opens on the last item with ArrowUp and runs the chosen action', () => {
    const onSelect = vi.fn()
    render(<Menu label="More actions" trigger="⋯" items={[{ label: 'Edit', onSelect: vi.fn() }, { label: 'Delete', onSelect }]} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions' }), { key: 'ArrowUp' })
    const del = screen.getByRole('menuitem', { name: 'Delete' })
    expect(del).toHaveFocus()
    fireEvent.click(del)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('ModalDialog and AlertDialog', () => {
  function Harness({ guard }: { guard?: () => boolean }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>New course</button>
        <ModalDialog
          open={open}
          onClose={() => setOpen(false)}
          title="New course"
          subtitle="A course pairs a student with a tutor over time."
          onRequestClose={guard}
          footer={<Button>Create course</Button>}
        >
          <input aria-label="Course name" data-autofocus="" />
        </ModalDialog>
      </>
    )
  }

  it('moves focus in, traps Tab, closes on Escape and restores focus', () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'New course' })
    opener.focus()
    fireEvent.click(opener)
    const dialog = screen.getByRole('dialog', { name: 'New course' })
    expect(dialog).toHaveAccessibleDescription('A course pairs a student with a tutor over time.')
    expect(screen.getByRole('textbox', { name: 'Course name' })).toHaveFocus()

    const create = screen.getByRole('button', { name: 'Create course' })
    create.focus()
    fireEvent.keyDown(create, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
  })

  it('asks the unsaved-changes guard before Escape or the close button closes it', () => {
    const guard = vi.fn(() => false)
    render(<Harness guard={guard} />)
    fireEvent.click(screen.getByRole('button', { name: 'New course' }))
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(guard).toHaveBeenCalledWith('dismiss')
    expect(guard).toHaveBeenCalledWith('close-button')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('becomes a full-screen sheet below 768px, while confirmations stay centred', () => {
    const { rerender } = render(<ModalDialog open onClose={() => {}} title="T" subtitle="S">body</ModalDialog>)
    const sheet = screen.getByRole('dialog')
    expect(sheet).toHaveAttribute('data-layout', 'sheet')
    expect(sheet).toHaveClass('max-md:h-dvh', 'max-md:rounded-none', 'md:max-w-[480px]', 'rounded-dashboard-dialog')
    rerender(<ModalDialog open onClose={() => {}} title="T" subtitle="S" phoneLayout="centred">body</ModalDialog>)
    expect(screen.getByRole('dialog')).toHaveAttribute('data-layout', 'centred')
    expect(screen.getByRole('dialog')).not.toHaveClass('max-md:h-dvh')
  })

  it('renders AlertDialog as alertdialog with focus on the safe choice', () => {
    const onCancel = vi.fn()
    render(<AlertDialog open title="Delete this lesson?" description="Students will no longer see it." confirmLabel="Delete" onConfirm={vi.fn()} onCancel={onCancel} />)
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this lesson?' })
    expect(dialog).toHaveClass('min-w-[min(320px,100%)]')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('UnderlineTabs', () => {
  function Tabs() {
    const [value, setValue] = useState('overview')
    const items = [{ id: 'overview', label: 'Overview' }, { id: 'plan', label: 'Course plan' }, { id: 'homework', label: 'Homework' }]
    return (
      <>
        <UnderlineTabs label="Course sections" idPrefix="course" items={items} value={value} onChange={setValue} />
        {items.map((item) => <TabPanel key={item.id} idPrefix="course" id={item.id} active={item.id === value}>{item.label} panel</TabPanel>)}
      </>
    )
  }

  it('selects with arrow keys, Home and End and links tabs to panels', () => {
    render(<Tabs />)
    const [overview, plan, homework] = screen.getAllByRole('tab')
    expect(overview).toHaveAttribute('aria-selected', 'true')
    expect(overview).toHaveAttribute('tabindex', '0')
    expect(plan).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toHaveTextContent('Overview panel')

    overview.focus()
    fireEvent.keyDown(overview, { key: 'ArrowRight' })
    expect(plan).toHaveAttribute('aria-selected', 'true')
    expect(plan).toHaveFocus()
    expect(screen.getByRole('tabpanel', { name: 'Course plan' })).toBeInTheDocument()
    fireEvent.keyDown(plan, { key: 'End' })
    expect(homework).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(homework, { key: 'ArrowRight' })
    expect(overview).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(overview, { key: 'ArrowLeft' })
    expect(homework).toHaveAttribute('aria-selected', 'true')
    expect(homework.querySelector('[data-underline]')).toHaveClass('bg-dashboard-location')
    expect(overview.querySelector('[data-underline]')).toBeNull()
  })

  it('link variant marks the current page', () => {
    render(<UnderlineTabLinks label="Lesson" currentHref="/lessons/1/summary" items={[{ href: '/lessons/1', label: 'Details' }, { href: '/lessons/1/summary', label: 'Lesson summary' }]} />)
    expect(screen.getByRole('link', { name: 'Lesson summary' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Details' })).not.toHaveAttribute('aria-current')
  })
})

describe('WizardProgress and WizardStep', () => {
  it('marks the current segment with the location colour and aria-current', () => {
    render(<WizardProgress steps={['Details', 'Schedule', 'Review']} current={1} />)
    const list = screen.getByRole('list', { name: 'Progress' })
    const segments = list.querySelectorAll('li')
    expect(segments[0]).toHaveAttribute('data-state', 'complete')
    expect(segments[1]).toHaveAttribute('aria-current', 'step')
    expect(segments[1].querySelector('[aria-hidden]')).toHaveClass('bg-dashboard-location')
    expect(segments[2]).toHaveAttribute('data-state', 'upcoming')
    expect(screen.getByText(/Step 2 of 3: Schedule, current step/)).toBeInTheDocument()
  })

  it('moves focus to the new step heading only when the step changes', () => {
    const { rerender } = render(<WizardStep stepKey="details" title="Details">a</WizardStep>)
    expect(screen.getByRole('heading', { name: 'Details' })).not.toHaveFocus()
    rerender(<WizardStep stepKey="schedule" title="Schedule" direction="forward">b</WizardStep>)
    expect(screen.getByRole('heading', { name: 'Schedule' })).toHaveFocus()
  })
})

describe('Pagination', () => {
  it('disables Previous on the first page and links Next with filters kept', () => {
    render(<Pagination page={1} pageCount={5} pathname="/lessons" search="?status=planned" />)
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/lessons?status=planned&page=2')
  })

  it('disables Next on the last page and drops page=1 from the Previous link', () => {
    render(<Pagination page={2} pageCount={2} pathname="/lessons" search="page=2" />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/lessons')
  })

  it('computes 25 per page and hides with one page', () => {
    expect(pageCountFor(0)).toBe(1)
    expect(pageCountFor(26)).toBe(2)
    expect(pageHref('/students', 'q=ann', 3)).toBe('/students?q=ann&page=3')
    const { container } = render(<Pagination page={1} pageCount={1} pathname="/x" search="" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ResponsiveTable, filters, states and helpers', () => {
  it('renders a table and phone cards that are real links', () => {
    const rows = [{ id: '1', name: 'Ada Lovelace', course: 'Maths', next: 'Tue 4pm' }]
    render(
      <ResponsiveTable
        caption="Students"
        rows={rows}
        getKey={(row) => row.id}
        getHref={(row) => `/students/${row.id}`}
        columns={[{ key: 'name', header: 'Name', cell: (row) => row.name }, { key: 'course', header: 'Course', cell: (row) => row.course }]}
        card={{ title: (row) => row.name, details: (row) => [row.course, row.next], status: () => <StatusChip status="planned" /> }}
      />,
    )
    expect(screen.getByRole('table', { name: 'Students' })).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links.every((link) => link.getAttribute('href') === '/students/1')).toBe(true)
    expect(screen.getByRole('list', { name: 'Students' })).toHaveTextContent('Maths · Tue 4pm')
  })

  it('removes an active filter chip by name', () => {
    const onRemove = vi.fn()
    render(<ActiveFilterChips filters={[{ key: 'status', label: 'Planned' }]} onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Planned' }))
    expect(onRemove).toHaveBeenCalledWith('status')
  })

  it('shows the SH-09 card error, stale line and entity empty state', () => {
    const retry = vi.fn()
    const { container } = render(<><ErrorState size="card" onRetry={retry} /><StaleDataNotice onRetry={retry} /><EmptyState entity="course" title="No courses yet" body="A course pairs a student with a tutor over time." /></>)
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load this.")
    fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0])
    expect(retry).toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent("You're seeing what was loaded before.")
    expect(container.querySelector('[data-entity="course"]')).not.toBeNull()
  })

  it('announces politely, offers a skip link and reports progress', () => {
    render(<><LiveRegion message="5 results" /><SkipLink /><TopProgressLine progress={42.4} /></>)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('status')).toHaveTextContent('5 results')
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('progressbar', { name: 'Loading page' })).toHaveAttribute('aria-valuenow', '42')
  })
})

describe('motion does not block input', () => {
  it('lets a click land during a dialog animation', () => {
    const onClick = vi.fn()
    render(<ModalDialog open onClose={() => {}} title="T" subtitle="S" footer={<Button onClick={onClick}>Save</Button>}>x</ModalDialog>)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
