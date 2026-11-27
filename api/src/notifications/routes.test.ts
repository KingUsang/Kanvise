import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { notificationPath, notificationRoutes } from './routes'

const appDir = join(__dirname, '../../../web/src/app')

/** Resolve a registry pattern to a page.tsx, treating ":id" as any [param] folder. */
function hasPage(pattern: string) {
  let current = appDir
  for (const segment of pattern.split('/').filter(Boolean)) {
    if (!segment.startsWith(':') && existsSync(join(current, segment))) { current = join(current, segment); continue }
    const dynamic = readdirSync(current).find((name) => /^\[[^\]]+\]$/.test(name))
    if (!dynamic) return false
    current = join(current, dynamic)
  }
  return existsSync(join(current, 'page.tsx'))
}

describe('notification route registry', () => {
  it('fills ids and rejects a missing one', () => {
    expect(notificationPath('learnerMock', 'abc')).toBe('/dashboard/student/mocks/abc')
    expect(notificationPath('learnerAssignments')).toBe('/dashboard/student/assignments')
    expect(() => notificationPath('classroom')).toThrow()
  })

  it.skipIf(!existsSync(appDir))('points every destination at an existing web page', () => {
    for (const pattern of Object.values(notificationRoutes)) expect(hasPage(pattern), pattern).toBe(true)
  })
})
