import { describe, expect, it } from 'vitest'
import manifest from './manifest'

describe('PWA manifest', () => {
  it('launches through the role-aware dashboard without declaring offline behavior', () => {
    const value = manifest()
    expect(value).toMatchObject({ name: 'Kanvise', short_name: 'Kanvise', start_url: '/dashboard', scope: '/', display: 'standalone' })
    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]))
  })
})
