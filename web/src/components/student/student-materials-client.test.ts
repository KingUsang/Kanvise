import { describe, expect, it } from 'vitest'
import { filterMaterials } from './student-materials-client'
import type { StudentMaterial } from '@/lib/student-materials'

const materials = [
  { id: 'one', title: 'Algebra notes', file_name: 'algebra.pdf', file_type: 'pdf', course_id: 'maths', course: { id: 'maths', name: 'Mathematics' } },
  { id: 'two', title: 'Motion slides', file_name: 'motion.pptx', file_type: 'pptx', course_id: 'physics', course: { id: 'physics', name: 'Physics' } },
] as StudentMaterial[]

describe('filterMaterials', () => {
  it('searches titles, file names, and course names', () => {
    expect(filterMaterials(materials, 'algebra', '', '').map(item => item.id)).toEqual(['one'])
    expect(filterMaterials(materials, 'physics', '', '').map(item => item.id)).toEqual(['two'])
  })
  it('combines course and file type filters', () => {
    expect(filterMaterials(materials, '', 'physics', 'pptx').map(item => item.id)).toEqual(['two'])
    expect(filterMaterials(materials, '', 'physics', 'pdf')).toEqual([])
  })
})
