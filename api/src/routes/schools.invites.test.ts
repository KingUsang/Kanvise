import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  sendTutorInvitation: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('../emails/send-tutor-invitation', () => ({
  sendTutorInvitation: mocks.sendTutorInvitation,
}))

vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('jwt_payload', { email: 'admin@example.com' })
    await next()
  },
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', { id: 'admin-1', school_id: 'school-1', role: 'admin', first_name: 'Ada', last_name: 'Okafor' })
    await next()
  },
  tenantMiddleware: async (_c: any, next: () => Promise<void>) => { await next() },
  requireRole: () => async (_c: any, next: () => Promise<void>) => { await next() },
}))

import { schoolsRouter } from './schools'

function query(result: unknown, terminal: 'maybeSingle' | 'single') {
  const builder: any = {
    select: () => builder,
    insert: () => builder,
    eq: () => builder,
    [terminal]: async () => result,
  }
  return builder
}

describe('POST /schools/me/invite/tutor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('FRONTEND_URL', 'https://kanvise.com')
    vi.stubEnv('INVITE_TOKEN_SECRET', 'test-invite-secret')
  })

  it('retains the invite and returns its URL when email delivery fails', async () => {
    const insertedInvite = {
      id: 'invite-1',
      email: 'tutor@example.com',
      expires_at: '2026-07-27T12:00:00.000Z',
    }
    let tutorInviteCall = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'tutor_invites') {
        tutorInviteCall += 1
        return tutorInviteCall === 1
          ? query({ data: null, error: null }, 'maybeSingle')
          : query({ data: insertedInvite, error: null }, 'single')
      }
      if (table === 'schools') return query({ data: { name: 'Bright Minds' }, error: null }, 'single')
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.sendTutorInvitation.mockRejectedValue(new Error('provider unavailable'))

    const response = await schoolsRouter.request('/me/invite/tutor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'Tutor@Example.com' }),
    })
    const body = await response.json() as any

    expect(response.status).toBe(201)
    expect(body.data.email_sent).toBe(false)
    expect(body.data.email_id).toBeNull()
    expect(body.data.invite_url).toMatch(/^https:\/\/kanvise\.com\/join\?token=/)
    expect(body.data.expires_at).toBe(insertedInvite.expires_at)
    expect(mocks.sendTutorInvitation).toHaveBeenCalledOnce()
  })
})

