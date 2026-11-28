import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardCapabilities } from '@/config/dashboard-navigation'
import { getBrowseTypes, highlightParts, shortcutHint, type SearchFunction, type SearchResponse } from '@/lib/search'
import { SearchProvider, SearchTrigger } from './search-palette'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/dashboard' }))

const agencyAdmin: DashboardCapabilities = { isAdmin: true, isTutor: true, organisationType: 'centre' }
const agencyTutor: DashboardCapabilities = { isAdmin: false, isTutor: true, organisationType: 'centre' }
const independent: DashboardCapabilities = { isAdmin: true, isTutor: true, organisationType: 'independent' }

const response: SearchResponse = {
  query: 'Ada',
  groups: [
    {
      type: 'student', label: 'Students', results: [
        { id: 's1', type: 'student', name: 'Ada Okonkwo', detail: 'ada@example.com', href: '/dashboard/students' },
        { id: 's2', type: 'student', name: 'Adaeze Nwosu', detail: 'No email', href: '/dashboard/students' },
      ],
    },
    {
      type: 'lesson', label: 'Lessons', results: [
        { id: 'l1', type: 'lesson', name: 'Ada catch-up', detail: 'Maths · 28 Nov 2026', href: '/dashboard/schedule/l1', status: 'planned' },
      ],
    },
  ],
}

function setup({ capabilities = agencyAdmin, search = vi.fn<SearchFunction>(async () => response) } = {}) {
  render(
    <SearchProvider capabilities={capabilities} search={search}>
      <SearchTrigger variant="sidebar" />
      <input aria-label="Other field" />
    </SearchProvider>,
  )
  return { search, trigger: screen.getByRole('button', { name: /Search/ }) }
}

function field() {
  return screen.getByRole('combobox', { name: 'Search' })
}

async function type(value: string) {
  fireEvent.change(field(), { target: { value } })
  await act(async () => { vi.advanceTimersByTime(250) })
  await act(async () => { await Promise.resolve() })
}

describe('search palette (SH-05, SH-12)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    push.mockReset()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('opens from the Search field with focus in a wired combobox', () => {
    const { trigger } = setup()
    fireEvent.click(trigger)
    const input = field()
    expect(input).toHaveFocus()
    const listbox = screen.getByRole('listbox')
    expect(input).toHaveAttribute('aria-controls', listbox.id)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[0].id)
    expect(screen.getByText('Navigate')).toBeInTheDocument()
  })

  it('opens with Cmd+K and Ctrl+K from anywhere', () => {
    setup()
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(field()).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    screen.getByRole('textbox', { name: 'Other field' }).focus()
    fireEvent.keyDown(document, { key: 'K', ctrlKey: true })
    expect(field()).toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the Search field', () => {
    const { trigger } = setup()
    screen.getByRole('textbox', { name: 'Other field' }).focus()
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('lists only the types this person can open, never Lessons', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    const group = screen.getByRole('group', { name: 'Browse by type' })
    expect(within(group).getAllByRole('option').map((option) => option.textContent)).toEqual(
      ['Students', 'Tutors', 'Courses', 'Homework', 'Quizzes', 'Resources', 'Settings'],
    )
  })

  it('hides Students and Tutors from an agency tutor', () => {
    setup({ capabilities: agencyTutor })
    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Courses', 'Homework', 'Quizzes', 'Resources'])
  })

  it('opens a browse type with Enter', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(push).toHaveBeenCalledWith('/dashboard/tutors')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows grouped results with highlighted matches and announces the count', async () => {
    const { search } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    await type('Ada')
    expect(search).toHaveBeenCalledWith('Ada')
    const students = screen.getByRole('group', { name: 'Students' })
    expect(within(students).getAllByRole('option')).toHaveLength(2)
    const lessons = screen.getByRole('group', { name: 'Lessons' })
    expect(within(lessons).getByText('Planned')).toBeInTheDocument()
    expect(document.querySelectorAll('mark')[0]).toHaveTextContent('Ada')
    expect(screen.getByRole('status')).toHaveTextContent('3 results')
  })

  it('moves aria-activedescendant across groups with the arrow keys and opens with Enter', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    await type('Ada')
    const options = screen.getAllByRole('option')
    expect(field()).toHaveAttribute('aria-activedescendant', options[0].id)
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    expect(field()).toHaveAttribute('aria-activedescendant', options[2].id)
    expect(options[2]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    expect(field()).toHaveAttribute('aria-activedescendant', options[0].id)
    fireEvent.keyDown(field(), { key: 'ArrowUp' })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(push).toHaveBeenCalledWith('/dashboard/schedule/l1')
  })

  it('waits for two characters before searching', async () => {
    const { search } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    await type('A')
    expect(search).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: 'Browse by type' })).toBeInTheDocument()
  })

  it('says when nothing matches', async () => {
    setup({ search: vi.fn<SearchFunction>(async () => ({ query: 'xyz', groups: [] })) })
    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    await type('xyz')
    expect(screen.getByText('No matches for "xyz".', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText("Try a student's name, a course or a lesson topic.")).toBeInTheDocument()
    expect(field()).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the error with Try again, which searches again', async () => {
    const search = vi.fn<SearchFunction>().mockRejectedValueOnce(new Error('down')).mockResolvedValue(response)
    setup({ search })
    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    await type('Ada')
    expect(screen.getByText("We couldn't search right now.", { selector: 'p' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await act(async () => { vi.advanceTimersByTime(250) })
    await act(async () => { await Promise.resolve() })
    expect(search).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('group', { name: 'Students' })).toBeInTheDocument()
  })

  it('says search needs a connection when offline', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { search } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    await type('Ada')
    expect(search).not.toHaveBeenCalled()
    expect(screen.getAllByText("You're offline. Search works when you're back online.").length).toBeGreaterThan(0)
    onLine.mockRestore()
  })
})

describe('search helpers', () => {
  it('highlights each typed word in any case', () => {
    expect(highlightParts('Ada Okonkwo', 'ada ok')).toEqual([
      { text: 'Ada', match: true }, { text: ' ', match: false }, { text: 'Ok', match: true }, { text: 'onkwo', match: false },
    ])
    expect(highlightParts('a+b', '+')).toEqual([{ text: 'a', match: false }, { text: '+', match: true }, { text: 'b', match: false }])
  })

  it('reads ⌘K on a Mac and Ctrl K elsewhere', () => {
    expect(shortcutHint('MacIntel')).toBe('⌘K')
    expect(shortcutHint('Win32')).toBe('Ctrl K')
  })

  it('leaves Tutors out of Browse by type for independent tutors', () => {
    expect(getBrowseTypes(independent).map((type) => type.label)).toEqual(['Students', 'Courses', 'Homework', 'Quizzes', 'Resources', 'Settings'])
  })
})
