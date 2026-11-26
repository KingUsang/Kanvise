import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const state = vi.hoisted(() => ({
  user: {} as any,
  memberships: [] as Array<{ school_id: string }>,
}))

vi.mock('../lib/supabase', () => {
  const chain = (table: string) => {
    const value: any = {
      select: () => value,
      eq: () => value,
      in: () => value,
      is: () => value,
      order: () => value,
      limit: () => value,
      maybeSingle: async () => table === 'account_memberships'
        ? { data: { id: 'm-1', school_id: state.memberships[0]?.school_id, role: 'learner', status: 'active' }, error: null }
        : table === 'schools' ? { data: { id: state.memberships[0]?.school_id }, error: null } : { data: null, error: null },
      single: async () => ({ data: null, error: null }),
      then: (resolve: (v: any) => void) => Promise.resolve(
        table === 'account_memberships' ? { data: state.memberships, error: null } : { data: [], error: null },
      ).then(resolve),
    }
    return value
  }
  return { supabase: { from: chain, rpc: vi.fn(async () => ({ data: null, error: null })) } }
})
vi.mock('../storage/r2', () => ({ createPresignedDownload: vi.fn(async () => 'signed-url') }))
vi.mock('../middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../middleware/auth')>()),
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', state.user); await next() },
}))

import { mocksRouter } from './mocks'
import { studentMocksRouter } from './student-mocks'

// Same relative order as index.ts: the student router must precede mocksRouter.
function app() {
  const hono = new Hono()
  hono.route('/', studentMocksRouter)
  hono.route('/mocks', mocksRouter)
  return hono
}

const ACCOUNT = '11111111-1111-4111-8111-111111111111'

describe('student mock routes behind the real /mocks router', () => {
  beforeEach(() => {
    state.user = { id: 'u-1', role: 'student', school_id: null }
    state.memberships = []
  })

  it('lets a standalone student with no header reach preflight', async () => {
    const response = await app().request('/mocks/mock-1/preflight')
    const body = await response.json().catch(() => ({}))
    expect(body.code).not.toBe('ACCOUNT_CONTEXT_REQUIRED')
    expect(response.status).not.toBe(400)
    expect(response.status).not.toBe(403)
  })

  it('falls back to the single active membership when a school student sends no header', async () => {
    state.user = { id: 'u-1', role: 'student', school_id: ACCOUNT }
    state.memberships = [{ school_id: ACCOUNT }]
    const response = await app().request('/mocks/mock-1/preflight')
    const body = await response.json().catch(() => ({}))
    expect(body.code).not.toBe('ACCOUNT_CONTEXT_REQUIRED')
    expect(response.status).not.toBe(400)
  })

  it('asks for an account selection when the learner has several memberships', async () => {
    state.memberships = [{ school_id: ACCOUNT }, { school_id: '22222222-2222-4222-8222-222222222222' }]
    const response = await app().request('/mocks/mock-1/attempts', { method: 'POST' })
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_SELECTION_REQUIRED' })
  })

  it('still gates tutor mock management on /mocks behind strict account context', async () => {
    state.user = { id: 'u-2', role: 'tutor', school_id: ACCOUNT }
    const response = await app().request('/mocks/ungraded-count')
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
  })
})
