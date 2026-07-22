import { describe, expect, it } from 'vitest'
import { resolveDashboardPersona } from './dashboard-persona'

describe('resolveDashboardPersona', () => {
  it('keeps a centre admin in the admin experience', () => {
    expect(resolveDashboardPersona({ isAdmin: true, isTutor: false })).toBe('admin')
  })

  it('keeps a pure tutor in the teaching experience', () => {
    expect(resolveDashboardPersona({ isAdmin: false, isTutor: true })).toBe('tutor')
  })

  it('gives an admin assigned to teach the combined solo-tutor experience', () => {
    expect(resolveDashboardPersona({ isAdmin: true, isTutor: true })).toBe('solo-tutor')
  })
})
