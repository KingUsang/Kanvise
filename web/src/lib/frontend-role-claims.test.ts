import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const roleSites = [
  'src/lib/supabase/middleware.ts',
  'src/app/dashboard/layout.tsx',
  'src/app/dashboard/question-banks/page.tsx',
] as const

function readRoleSite(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('frontend role claim boundaries', () => {
  it('never uses editable user metadata as a role authority', () => {
    for (const path of roleSites) {
      const source = readRoleSite(path)
      expect(source, `${path} must not read editable role metadata`).not.toMatch(/user_metadata\??\.\s*kanvise_role/)
    }
  })

  it('keeps app metadata compatibility hints and safe role fallbacks', () => {
    const middleware = readRoleSite(roleSites[0])
    const layout = readRoleSite(roleSites[1])
    const questionBanks = readRoleSite(roleSites[2])

    expect(middleware).toContain("appMetadata.kanvise_role || appMetadata.role || 'student'")
    expect(layout).toContain('user.app_metadata?.kanvise_role')
    expect(layout).toContain('user.app_metadata?.role')
    expect(layout).toContain('user.user_metadata?.first_name')
    expect(layout).toContain('user.user_metadata?.last_name')
    expect(questionBanks).toContain('user.app_metadata?.kanvise_role || user.app_metadata?.role')
  })
})
