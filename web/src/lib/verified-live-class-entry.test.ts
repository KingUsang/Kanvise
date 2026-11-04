import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pagePath = 'src/app/class/[id]/page.tsx'
const pageSource = readFileSync(resolve(process.cwd(), pagePath), 'utf8')

describe('verified live-class entry', () => {
  it('gates the authenticated classroom branch with claims before reading session data', () => {
    const claimsIndex = pageSource.indexOf('auth.getClaims()')
    const sessionIndex = pageSource.indexOf('auth.getSession()')

    expect(claimsIndex).toBeGreaterThanOrEqual(0)
    expect(sessionIndex).toBeGreaterThan(claimsIndex)
    expect(pageSource).toContain('if (claimsError || !claims) {')
    expect(pageSource).toContain('<PreparingClassroom')
  })

  it('preserves the public fallback messages and classroom start/join props', () => {
    expect(pageSource).toContain('Class not found')
    expect(pageSource).toContain('This class is for enrolled learners only')
    expect(pageSource).toContain('Use the class link')
    expect(pageSource).toContain('access_mode')
    expect(pageSource).toContain('isStarting={isStarting}')
    expect(pageSource).toContain('isHost={isStarting}')
    expect(pageSource).toContain('studentName={sessionUser?.user_metadata?.first_name || \'Tutor\'}')
    expect(pageSource).toContain('studentId={sessionUser?.id || claims.sub}')
  })
})
