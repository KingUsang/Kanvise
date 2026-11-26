import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({ resolved: vi.fn(), memberships: [] as Array<{ school_id: string }> }))
vi.mock('../lib/supabase', () => {
  const value: any = {
    select: () => value, eq: () => value, limit: () => value,
    then: (resolve: (v: any) => void) => Promise.resolve({ data: mocks.memberships, error: null }).then(resolve),
  }
  return { supabase: { from: () => value } }
})
vi.mock('./auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./auth')>()),
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    mocks.resolved()
    c.set('account', { id: 'account-1', membershipId: 'm-1', role: 'learner' })
    await next()
  },
  resolveAccountContext: async (c: any, next: () => Promise<void>, id: string) => {
    mocks.resolved(id)
    c.set('account', { id, membershipId: 'm-1', role: 'learner' })
    await next()
  },
}))

import { accountUserProjection, standaloneAwareAccountContext, standaloneAwareAccountProjection } from './account-projection'

function app(user: any) {
  const hono = new Hono()
  hono.use('*', async (c, next) => { c.set('user', user); await next() })
  hono.use('*', standaloneAwareAccountContext, standaloneAwareAccountProjection)
  hono.get('/', (c) => c.json({ user: c.get('user') }))
  return hono
}

describe('account user projection', () => {
  it('replaces profile tenant and role with the membership values', async () => {
    const hono = new Hono()
    hono.use('*', async (c, next) => { c.set('user', { id: 'u', school_id: 'profile', role: 'admin' }); c.set('account', { id: 'account-1', membershipId: 'm', role: 'learner' }); await next() })
    hono.use('*', accountUserProjection)
    hono.get('/', (c) => c.json(c.get('user')))
    await expect((await hono.request('/')).json()).resolves.toMatchObject({ school_id: 'account-1', role: 'student' })
  })

  it('refuses to project without a resolved account', async () => {
    const hono = new Hono()
    hono.use('*', async (c, next) => { c.set('user', { id: 'u' }); await next() })
    hono.use('*', accountUserProjection)
    hono.get('/', (c) => c.json({}))
    expect((await hono.request('/')).status).toBe(400)
  })

  it('lets a standalone-mock student with no account and no header continue without a tenant', async () => {
    mocks.resolved.mockClear()
    const response = await app({ id: 'u', role: 'student', school_id: null }).request('/')
    expect(response.status).toBe(200)
    expect(mocks.resolved).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ user: { school_id: null } })
  })

  it('falls back to the single active learner membership when no header is sent', async () => {
    mocks.resolved.mockClear()
    mocks.memberships = [{ school_id: 'account-9' }]
    const response = await app({ id: 'u', role: 'student', school_id: 'profile' }).request('/')
    await expect(response.json()).resolves.toMatchObject({ user: { school_id: 'account-9' } })
    expect(mocks.resolved).toHaveBeenCalledWith('account-9')
    mocks.memberships = []
  })

  it('asks for a selection when a header-less student has several memberships', async () => {
    mocks.resolved.mockClear()
    mocks.memberships = [{ school_id: 'account-1' }, { school_id: 'account-2' }]
    const response = await app({ id: 'u', role: 'student', school_id: null }).request('/')
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_SELECTION_REQUIRED' })
    expect(mocks.resolved).not.toHaveBeenCalled()
    mocks.memberships = []
  })

  it('resolves the membership when a header names an account or the profile has one', async () => {
    mocks.resolved.mockClear()
    const named = await app({ id: 'u', role: 'student', school_id: null }).request('/', { headers: { 'X-Kanvise-Account-Id': 'account-1' } })
    await expect(named.json()).resolves.toMatchObject({ user: { school_id: 'account-1' } })
    const profiled = await app({ id: 'u', role: 'student', school_id: 'profile' }).request('/')
    await expect(profiled.json()).resolves.toMatchObject({ user: { school_id: 'account-1' } })
    expect(mocks.resolved).toHaveBeenCalledTimes(2)
  })
})
