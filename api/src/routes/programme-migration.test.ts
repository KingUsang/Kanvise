import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('programme setup migration', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20261012020000_idempotent_class_setup_and_subject_creation.sql', import.meta.url), 'utf8')
  const coursesRoute = readFileSync(new URL('./courses.ts', import.meta.url), 'utf8')

  it('uses one invoker-security transaction restricted to service_role', () => {
    expect(sql).toMatch(/SECURITY INVOKER/i)
    expect(sql).toContain("role = 'admin'")
    expect(sql).toContain('public.setup_programme(')
    expect(sql).toContain("message = 'TUTOR_SCHOOL_MISMATCH'")
    expect(sql).toMatch(/revoke execute[\s\S]+from public, anon, authenticated/i)
    expect(sql).toMatch(/grant execute[\s\S]+to service_role/i)
  })

  it('always inserts programmes and subjects unpublished', () => {
    // setup_programme (programme and subjects) and add_programme_subject.
    expect(sql.match(/false, p_created_by/g)).toHaveLength(3)
    // PATCH accepts only allow-listed columns, so is_published can never be set through it.
    const patchSchema = coursesRoute.slice(coursesRoute.indexOf('const subjectUpdateSchema'), coursesRoute.indexOf('.partial().strict()'))
    expect(patchSchema).toContain('sort_order')
    expect(patchSchema).not.toContain('is_published')
    expect(coursesRoute).toContain('.partial().strict()')
  })
})
