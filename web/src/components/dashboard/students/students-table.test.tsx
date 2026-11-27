import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./student-details-sheet', () => ({ default: () => null }))

import StudentsTable from './students-table'

describe('StudentsTable sub-programme display (DEV-SUB-006)', () => {
  it('does not show sub-programme names in the filter or enrolment chips', () => {
    const students = [{
      id: 's1', first_name: 'Ada', last_name: 'Obi', email: 'ada@example.com', kanvise_user_id: 'KNV-STU-00001',
      enrolments: [
        { id: 'e1', sub_programmes: { id: 'sp1', name: 'Hidden Section' } },
        { id: 'e2', programmes: { id: 'p1', name: 'Physics Class' } },
      ],
    }]

    render(<StudentsTable students={students} onStudentRemoved={() => {}} onStudentsChanged={() => {}} />)

    expect(screen.queryAllByText(/Hidden Section/)).toHaveLength(0)
    expect(screen.queryAllByText(/Class section/)).toHaveLength(0)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['All enrolments', 'Class — Physics Class'])
  })
})

describe('StudentsTable URL state (DEV-FE-031)', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))
  const students = [
    { id: 's1', first_name: 'Ada', last_name: 'Obi', email: 'ada@example.com', kanvise_user_id: 'K1', enrolments: [] },
    { id: 's2', first_name: 'Bayo', last_name: 'Eze', email: 'bayo@example.com', kanvise_user_id: 'K2', enrolments: [] },
  ]

  it('restores the search from the URL and writes changes back', () => {
    window.history.replaceState(null, '', '/dashboard/students?q=bayo')
    render(<StudentsTable students={students} onStudentRemoved={() => {}} onStudentsChanged={() => {}} />)
    const input = screen.getByPlaceholderText(/Search name/) as HTMLInputElement
    expect(input.value).toBe('bayo')
    expect(screen.queryByText(/Ada Obi/)).toBeNull()
    fireEvent.change(input, { target: { value: 'ada' } })
    expect(window.location.search).toBe('?q=ada')
    fireEvent.change(input, { target: { value: '' } })
    expect(window.location.search).toBe('')
  })
})
