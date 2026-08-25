import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('programme setup migration', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20260824222423_programme_setup_transaction.sql', import.meta.url), 'utf8')
  const coursesRoute = readFileSync(new URL('./courses.ts', import.meta.url), 'utf8')

  it('uses one invoker-security transaction restricted to service_role', () => {
    expect(sql).toContain('security invoker')
    expect(sql).toContain("role = 'admin'")
    expect(sql).toContain("message = 'TUTOR_SCHOOL_MISMATCH'")
    expect(sql).toMatch(/revoke execute[\s\S]+from public, anon, authenticated/i)
    expect(sql).toMatch(/grant execute[\s\S]+to service_role/i)
  })

  it('always inserts programmes and subjects unpublished', () => {
    expect(sql.match(/false, p_created_by/g)).toHaveLength(2)
    expect(coursesRoute).toContain('delete updates.is_published')
  })
})
