import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('@sentry/node', () => ({
  setUser: mocks.setUser,
  setTag: mocks.setTag,
}))

import { profileResolutionMiddleware } from './auth'

const canonicalProfile = {
  id: 'profile-db',
  role: 'tutor',
  school_id: 'school-db',
  kanvise_user_id: 'KNV-TUT-00001',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@kanvise.com',
  is_active: true,
}

function profileLookup(result: unknown) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  }
  mocks.from.mockReturnValue(builder)
  return builder
}

async function resolve(path: string, lookup: unknown, payload: Record<string, unknown> = {}) {
  profileLookup(lookup)
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('jwt_payload', {
      sub: 'auth-user-1',
      email: 'jwt@example.com',
      app_metadata: {
        role: 'admin',
        school_id: 'stale-school',
        profile_id: 'stale-profile',
        kanvise_user_id: 'KNV-ADM-99999',
      },
      ...payload,
    })
    return profileResolutionMiddleware(c, next)
  })
  app.all('*', (c) => c.json({ user: c.get('user') }))
  return app.request(path, { method: 'POST' })
}

describe('profileResolutionMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the canonical database profile instead of stale JWT metadata', async () => {
    const response = await resolve('/protected', { data: canonicalProfile, error: null })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      user: {
        id: canonicalProfile.id,
        role: canonicalProfile.role,
        school_id: canonicalProfile.school_id,
        kanvise_user_id: canonicalProfile.kanvise_user_id,
        first_name: canonicalProfile.first_name,
        last_name: canonicalProfile.last_name,
        email: canonicalProfile.email,
        supabase_auth_id: 'auth-user-1',
      },
    })
    expect(mocks.from).toHaveBeenCalledWith('user_profiles')
  })

  it('rejects a deactivated canonical profile', async () => {
    const response = await resolve('/protected', { data: { ...canonicalProfile, is_active: false }, error: null })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'This account has been deactivated', code: 'ACCOUNT_INACTIVE' })
  })

  it('rejects a missing canonical profile', async () => {
    const response = await resolve('/protected', { data: null, error: null })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'User profile not found', code: 'PROFILE_NOT_FOUND' })
  })

  it('fails closed with a distinct database lookup error', async () => {
    const response = await resolve('/protected', { data: null, error: { message: 'database unavailable' } })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Could not resolve your profile right now', code: 'PROFILE_LOOKUP_FAILED' })
  })

  it('resolves a valid active profile and falls back to the verified email only when needed', async () => {
    const response = await resolve('/protected', { data: { ...canonicalProfile, email: null }, error: null })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      user: {
        id: canonicalProfile.id,
        role: canonicalProfile.role,
        school_id: canonicalProfile.school_id,
        kanvise_user_id: canonicalProfile.kanvise_user_id,
        first_name: canonicalProfile.first_name,
        last_name: canonicalProfile.last_name,
        email: 'jwt@example.com',
        supabase_auth_id: 'auth-user-1',
      },
    })
  })

  it('preserves profile initialization when no profile exists yet', async () => {
    const response = await resolve('/auth/profile/init', { data: null, error: null })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ user: { supabase_auth_id: 'auth-user-1', email: 'jwt@example.com' } })
  })

  it('does not bypass a profile-init database failure', async () => {
    const response = await resolve('/auth/profile/init', { data: null, error: { message: 'database unavailable' } })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Could not resolve your profile right now', code: 'PROFILE_LOOKUP_FAILED' })
  })
})
