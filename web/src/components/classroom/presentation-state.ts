import type { PresentationMaterial } from './presentation-session'

export function synchronizePage(materials: PresentationMaterial[], materialId: string, page: number) {
  return materials.map((item) => item.id === materialId ? { ...item, current_page: page } : item)
}

export function activateMaterial(materials: PresentationMaterial[], active: PresentationMaterial) {
  const exists = materials.some((item) => item.id === active.id)
  const next = materials.map((item) => item.id === active.id ? { ...active, is_active: true } : { ...item, is_active: false })
  return exists ? next : [...next, { ...active, is_active: true }]
}

export function closeMaterials(materials: PresentationMaterial[]) {
  return materials.map((item) => ({ ...item, is_active: false }))
}

export function nextLocalZoom(current: number, delta: number) {
  return Math.min(2.5, Math.max(.5, Math.round((current + delta) * 10) / 10))
}
