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

    expect(discovered).toHaveLength(44)
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
    const entry = routePolicyInventory.find((candidate) => candidate.router === 'avatarsRouter')
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
      `${entry!.key} is protected-account but lacks the required JWT/profile plus tenant or account-context sequence or a recorded knownGap`,
    )
  })

  it('records no known gaps now that every protected router resolves the selected account', () => {
    const gaps = routePolicyInventory.flatMap((entry) => [
      ...(entry.knownGap ? [entry.key] : []),
      ...(entry.families || []).filter((family) => family.knownGap).map((family) => `${entry.key} ${family.paths.join(',')}`),
    ])
    expect(gaps).toEqual([])
  })

  it('keeps the profile tenant middleware out of every router the inventory places on the account sequence', () => {
    const claimed = routePolicyInventory.filter((entry) => entry.observedMiddleware.includes('accountContextMiddleware'))
    expect(claimed.length).toBeGreaterThan(20)
    for (const entry of claimed) {
      const source = readFileSync(resolve(process.cwd(), entry.source), 'utf8')
      expect(source, `${entry.key} must resolve the selected account`).toMatch(/accountContextMiddleware|standaloneAwareAccountContext/)
      expect(source, `${entry.key} must not use profile-tenant tenantMiddleware (DEV-SEC-004)`).not.toMatch(/\btenantMiddleware\b/)
    }
  })

  it('keeps non-browser callers (webhooks, internal service, public routers) outside account context middleware', () => {
    const accountSources = new Set(routePolicyInventory
      .filter((entry) => entry.policy !== 'public' && entry.policy !== 'webhook' && entry.policy !== 'internal-service')
      .map((entry) => entry.source))
    const outside = routePolicyInventory.filter((entry) => entry.kind === 'router'
      && ['public', 'webhook', 'internal-service'].includes(entry.policy)
      && !accountSources.has(entry.source))
    expect(outside.map((entry) => entry.router)).toEqual(expect.arrayContaining(['webhooksRouter', 'internalPaymentsRouter', 'publicLiveClassesRouter', 'healthRouter']))
    for (const entry of outside) {
      const source = readFileSync(resolve(process.cwd(), entry.source), 'utf8')
      expect(source, `${entry.key} must not require a selected account`).not.toMatch(/accountContextMiddleware|standaloneAwareAccountContext/)
      expect(entry.observedMiddleware).not.toContain('accountContextMiddleware')
    }
  })

  it('moves live-class and slides routers off the profile tenant (DEV-SEC-005, DEV-API-007)', () => {
    for (const routerName of ['liveClassesRouter', 'slidesRouter']) {
      const entry = routePolicyInventory.find((candidate) => candidate.router === routerName)
      expect(entry?.observedMiddleware).toContain('accountContextMiddleware')
      expect(entry?.observedMiddleware).not.toContain('tenantMiddleware')
    }
  })
})
