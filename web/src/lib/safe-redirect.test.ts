import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from './safe-redirect'

describe('safeRedirectPath', () => {
  it('keeps same-origin application paths with query and hash', () => {
    expect(safeRedirectPath('/dashboard/student/mocks?tab=active#latest')).toBe('/dashboard/student/mocks?tab=active#latest')
  })

  it.each(['https://evil.test/x', '//evil.test/x', '/\\evil.test', '/auth/login', '', null])('rejects unsafe redirect %s', value => {
    expect(safeRedirectPath(value)).toBeNull()
  })
})
