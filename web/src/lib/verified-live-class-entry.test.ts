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

  it('preserves the public fallback messages and leaves start/join to the canonical class link', () => {
    expect(pageSource).toContain('Class not found')
    expect(pageSource).toContain('This class is for enrolled learners only')
    expect(pageSource).toContain('Use the class link')
    expect(pageSource).toContain('access_mode')
    // The canonical link has no ?start=true flag; PreparingClassroom resolves host or guest on the client.
    expect(pageSource).not.toContain('isStarting')
    expect(pageSource).not.toContain('searchParams')
  })
})
