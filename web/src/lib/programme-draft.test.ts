import { describe, expect, it } from 'vitest'
import {
  loadProgrammeDraft,
  PROGRAMME_DRAFT_TTL_MS,
  programmeDraftKey,
  saveProgrammeDraft,
} from './programme-draft'

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const data = {
  name: 'JAMB Chemistry', description: 'Preparation', price: '15000', step: 2,
  coverFileName: 'chemistry.webp',
  subjects: [{ clientId: 'subject-1', name: 'Chemistry', description: '', tutorIds: ['tutor-1'] }],
}

describe('programme drafts', () => {
  it('isolates and restores a versioned draft per centre, profile, and programme', () => {
    const storage = new MemoryStorage()
    saveProgrammeDraft('school-1', 'admin-1', data, 'new', storage as any, 1000)
    expect(loadProgrammeDraft('school-1', 'admin-1', 'new', storage as any, 2000)).toMatchObject({ savedAt: 1000, data })
    expect(loadProgrammeDraft('school-2', 'admin-1', 'new', storage as any, 2000)).toBeNull()
    expect(programmeDraftKey('school-1', 'admin-1')).toContain('v1:school-1:admin-1:new')
  })

  it('expires and removes drafts after 30 days', () => {
    const storage = new MemoryStorage()
    saveProgrammeDraft('school-1', 'admin-1', data, 'new', storage as any, 1000)
    expect(loadProgrammeDraft('school-1', 'admin-1', 'new', storage as any, 1000 + PROGRAMME_DRAFT_TTL_MS + 1)).toBeNull()
    expect(storage.values.size).toBe(0)
  })

  it('persists only cover metadata so a browser refresh requires file reselection', () => {
    const storage = new MemoryStorage()
    saveProgrammeDraft('school-1', 'admin-1', data, 'new', storage as any, 1000)
    const restored = loadProgrammeDraft('school-1', 'admin-1', 'new', storage as any, 2000)
    expect(restored?.data.coverFileName).toBe('chemistry.webp')
    expect(restored?.data).not.toHaveProperty('coverFile')
  })
})
