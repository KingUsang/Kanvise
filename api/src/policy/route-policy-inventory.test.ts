import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  discoverMountedRouteKeys,
  REQUIRED_PROTECTED_MIDDLEWARE,
  routePolicyInventory,
  validateCurrentRoutePolicyInventory,
  validateRoutePolicyInventory,
} from './route-policy-inventory'

const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8')

describe('route policy inventory', () => {
  it('classifies every mounted router and inline route in the live API assembly', () => {
    const discovered = discoverMountedRouteKeys(indexSource)

    expect(discovered).toHaveLength(47)
    expect(new Set(discovered).size).toBe(discovered.length)
    expect(validateCurrentRoutePolicyInventory(indexSource)).toEqual([])
    expect(routePolicyInventory).toHaveLength(discovered.length)
  })

  it('rejects an assembly mount without an inventory policy', () => {
    const discovered = discoverMountedRouteKeys(indexSource)
    const errors = validateRoutePolicyInventory([...discovered, 'router:/new|newRouter'])

    expect(errors).toContain('unclassified mounted route: router:/new|newRouter')
  })

  it('rejects a protected route missing tenant middleware when no exception is recorded', () => {
    const entry = routePolicyInventory.find((candidate) => candidate.router === 'schoolsRouter')
    expect(entry).toBeDefined()
    const incomplete = {
      ...entry!,
      observedMiddleware: REQUIRED_PROTECTED_MIDDLEWARE.slice(0, 2),
      knownGap: undefined,
    }

    const errors = validateRoutePolicyInventory(
      [incomplete.key],
      [incomplete],
    )

    expect(errors).toContain(
      `${entry!.key} is protected-account but lacks the required JWT/profile/tenant sequence or a recorded knownGap`,
    )
  })
})
