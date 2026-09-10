import { describe, expect, it } from 'vitest'
import { titleFromFileName } from './upload-with-progress'

describe('upload helpers', () => {
  it('derives a readable editable title from a filename', () => {
    expect(titleFromFileName('week-04_cell-division.pdf')).toBe('week 04 cell division')
    expect(titleFromFileName('JAMB Revision Notes.PPTX')).toBe('JAMB Revision Notes')
    expect(titleFromFileName('.pdf')).toBe('.pdf')
  })
})
