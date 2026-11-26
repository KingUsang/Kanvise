import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({ resolved: vi.fn() }))
vi.mock('./auth', () => ({
  ACCOUNT_CONTEXT_HEADER: 'X-Kanvise-Account-Id',
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    mocks.resolved()
    c.set('account', { id: 'account-1', membershipId: 'm-1', role: 'learner' })
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

  it('resolves the membership when a header names an account or the profile has one', async () => {
    mocks.resolved.mockClear()
    const named = await app({ id: 'u', role: 'student', school_id: null }).request('/', { headers: { 'X-Kanvise-Account-Id': 'account-1' } })
    await expect(named.json()).resolves.toMatchObject({ user: { school_id: 'account-1' } })
    const profiled = await app({ id: 'u', role: 'student', school_id: 'profile' }).request('/')
    await expect(profiled.json()).resolves.toMatchObject({ user: { school_id: 'account-1' } })
    expect(mocks.resolved).toHaveBeenCalledTimes(2)
  })
})
