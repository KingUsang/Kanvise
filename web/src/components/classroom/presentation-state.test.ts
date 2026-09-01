import { describe, expect, it } from 'vitest'
import { activateMaterial, closeMaterials, nextLocalZoom, synchronizePage } from './presentation-state'
import type { PresentationMaterial } from './presentation-session'

const material = (id: string, page = 1): PresentationMaterial => ({
  id, filename: `${id}.pdf`, file_size_bytes: 100, page_count: 10, sort_order: 0,
  current_page: page, is_active: id === 'a', annotations: {}, created_at: '', updated_at: '',
})

describe('presentation synchronization state', () => {
  it('makes students follow the tutor page without changing unrelated materials', () => {
    const next = synchronizePage([material('a'), material('b', 4)], 'a', 7)
    expect(next.map((item) => item.current_page)).toEqual([7, 4])
  })

  it('switches teaching materials and closes presentation mode cleanly', () => {
    const activated = activateMaterial([material('a'), material('b')], { ...material('b'), is_active: true })
    expect(activated.map((item) => item.is_active)).toEqual([false, true])
    expect(closeMaterials(activated).every((item) => !item.is_active)).toBe(true)
  })

  it('keeps zoom local and bounded independently of synchronized page state', () => {
    const materials = [material('a', 3)]
    expect(nextLocalZoom(1, .1)).toBe(1.1)
    expect(nextLocalZoom(2.5, .1)).toBe(2.5)
    expect(materials[0].current_page).toBe(3)
  })
})
