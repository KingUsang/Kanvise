import { describe, expect, it, vi } from 'vitest'
import { clampRosterPage, downloadStudentRosterCsv, neutralizeSpreadsheetFormula, serializeStudentRosterCsv } from './student-roster'

describe('student roster export', () => {
  it('clamps a removed final page to the new valid range', () => {
    expect(clampRosterPage(10, 9)).toBe(9)
    expect(clampRosterPage(1, 0)).toBe(1)
  })

  it('quotes cells and neutralizes spreadsheet formulas in the displayed projection', () => {
    expect(neutralizeSpreadsheetFormula('=HYPERLINK("https://evil.test")')).toBe("'=HYPERLINK(\"https://evil.test\")")
    expect(serializeStudentRosterCsv([{
      kanvise_user_id: 'KNV-STU-1',
      first_name: 'Ada,',
      last_name: '"Okafor"',
      email: '=evil@example.test',
      enrolments: [{ id: 'enrolment-1' }],
    }])).toBe([
      '"Kanvise ID","First Name","Last Name","Email","Enrolments Count"',
      '"KNV-STU-1","Ada,","""Okafor""","\'=evil@example.test","1"',
      '',
    ].join('\r\n'))
  })

  it('downloads through a Blob URL and revokes the URL', () => {
    const url = 'blob:test'
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => url), revokeObjectURL: vi.fn() })
    const click = vi.fn()
    const link = { href: '', download: '', click } as unknown as HTMLAnchorElement
    vi.spyOn(document, 'createElement').mockReturnValue(link)
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)

    expect(downloadStudentRosterCsv([{ first_name: 'Ada', enrolments: [] }])).toBe(true)
    expect(click).toHaveBeenCalledOnce()
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
  })
})
