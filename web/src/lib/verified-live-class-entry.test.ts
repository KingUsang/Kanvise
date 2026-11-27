import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pagePath = 'src/app/class/[id]/page.tsx'
const pageSource = readFileSync(resolve(process.cwd(), pagePath), 'utf8')

describe('verified live-class entry', () => {
  it('gates the authenticated classroom branch with claims and never reads session data', () => {
    expect(pageSource.indexOf('auth.getClaims()')).toBeGreaterThanOrEqual(0)
    expect(pageSource).not.toContain('auth.getSession()')
    expect(pageSource).toContain('if (claimsError || !claims) {')
    expect(pageSource).toContain('<PreparingClassroom')
  })

  it('never reads a class by bare id without a session and leaves start/join to the canonical class link', () => {
    // A bare class id is not a capability: no public by-id read, only the opaque token redirect.
    expect(pageSource).not.toContain('/public/live-classes/by-id')
    expect(pageSource).toContain('Use the class link or sign in')
    expect(pageSource).toContain('redirect(`/live/${shareToken}`)')
    // The canonical link has no ?start=true flag; PreparingClassroom resolves host or guest on the client.
    expect(pageSource).not.toContain('isStarting')
  })
})
