import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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
