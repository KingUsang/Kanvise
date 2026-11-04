import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const protectedPages = {
  tutors: 'src/app/dashboard/tutors/page.tsx',
  studentLayout: 'src/app/dashboard/student/layout.tsx',
  notes: 'src/app/dashboard/notes/page.tsx',
  submissions: 'src/app/dashboard/assignments/[assignmentId]/submissions/page.tsx',
  mockBuilder: 'src/app/dashboard/mocks/builder/page.tsx',
} as const

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('verified protected server pages', () => {
  it('uses verified claims and leaves no session-only access check', () => {
    for (const path of Object.values(protectedPages)) {
      const contents = source(path)
      expect(contents, `${path} must verify claims`).toContain('auth.getClaims()')
      expect(contents, `${path} must not use a session payload as its access check`).not.toContain('auth.getSession()')
    }
  })

  it('preserves each page redirect and claims-based staff role gate', () => {
    expect(source(protectedPages.tutors)).toContain("if (error || !claims) redirect('/')")
    expect(source(protectedPages.studentLayout)).toContain('if (error || !claims) redirect("/auth/login");')
    expect(source(protectedPages.mockBuilder)).toContain('if (error || !claims) {\n    redirect("/auth/login");')

    for (const path of [protectedPages.notes, protectedPages.submissions]) {
      const contents = source(path)
      expect(contents).toContain("if (error || !claims) {")
      expect(contents).toContain("redirect('/')")
      expect(contents).toContain('claims.app_metadata?.kanvise_role || claims.app_metadata?.role')
      expect(contents).toContain("redirect('/dashboard')")
    }
  })
})
