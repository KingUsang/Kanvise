import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  sendEmail: vi.fn(async () => undefined),
  inserted: null as any,
  user: { id: 'person-1', school_id: 'legacy-account', role: 'admin', email: null, first_name: 'Admin' } as any,
  account: { id: 'account-1', membershipId: 'membership-1', role: 'admin' } as any,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../emails/config', () => ({ getEmailConfig: () => ({ from: 'noreply@example.com' }) }))
vi.mock('../emails/provider-router', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => { c.set('user', mocks.user); await next() },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    if (!mocks.account) return c.json({ error: 'A valid tutoring account must be selected', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
    c.set('account', mocks.account)
    await next()
  },
  requireMembershipRole: (...roles: string[]) => async (c: any, next: () => Promise<void>) => {
    if (!roles.includes(c.get('account')?.role)) return c.json({ error: 'Insufficient role', code: 'INSUFFICIENT_ROLE' }, 403)
    await next()
  },
}))

import { createResolveToken, feedbackResolutionRouter, feedbackRouter } from './feedback'

function query(result: any) {
  const builder: any = {
    insert: vi.fn((value: any) => { mocks.inserted = value; return builder }),
    update: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(async () => result),
    then: (resolve: (value: any) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

describe('feedback account policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.inserted = null
    mocks.user = { id: 'person-1', school_id: 'legacy-account', role: 'admin', email: null, first_name: 'Admin' }
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'admin' }
    process.env.KANVISE_INTERNAL_SECRET = 'feedback-test-secret'
  })

  it('requires a selected active account before creating feedback', async () => {
    mocks.account = null

    const response = await feedbackRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'feature', description: 'Improve the timetable' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ACCOUNT_CONTEXT_REQUIRED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('stores feedback in the selected account while retaining the verified person', async () => {
    mocks.from.mockReturnValue(query({ data: { id: 'report-1' }, error: null }))

    const response = await feedbackRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'focused-test' },
      body: JSON.stringify({ kind: 'feature', description: 'Improve the timetable' }),
    })

    expect(response.status).toBe(201)
    expect(mocks.inserted).toMatchObject({ reporter_id: 'person-1', school_id: 'account-1', kind: 'feature' })
    expect(mocks.inserted.school_id).not.toBe('legacy-account')
    expect(mocks.sendEmail).toHaveBeenCalled()
  })

  it('rejects an unsupported account capability before persistence', async () => {
    mocks.account = { id: 'account-1', membershipId: 'membership-1', role: 'super_admin' }

    const response = await feedbackRouter.request('/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'feature', description: 'Improve the timetable' }),
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'INSUFFICIENT_ROLE' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('maps persistence failure without exposing provider details', async () => {
    mocks.user.id = 'person-failure'
    mocks.from.mockReturnValue(query({ data: null, error: { message: 'secret database detail' } }))

    const response = await feedbackRouter.request('/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'feature', description: 'Improve the timetable' }),
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'We could not send your report. Please try again.', code: 'FEEDBACK_CREATE_FAILED' })
  })

  it('keeps signed public resolution separate from membership policy', async () => {
    const response = await feedbackResolutionRouter.request('/report-1/resolve?token=wrong')

    expect(response.status).toBe(403)
    expect(await response.text()).toBe('Invalid or expired resolution link.')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an oversized screenshot before decoding or writing a report', async () => {
    const response = await feedbackRouter.request('/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'feature', description: 'x', screenshot: { name: 'a.png', content_type: 'image/png', data: 'A'.repeat(7_000_000) } }),
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'SCREENSHOT_FAILED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an oversized body with 413 even without a Content-Length header', async () => {
    const encoder = new TextEncoder()
    const chunk = encoder.encode('x'.repeat(1024 * 1024))
    let sent = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent++ < 9) controller.enqueue(chunk)
        else controller.close()
      },
    })
    const response = await feedbackRouter.request('/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: stream, duplex: 'half',
    } as RequestInit)
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an over-long attempted action', async () => {
    const response = await feedbackRouter.request('/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'feature', description: 'x', attempted_action: 'a'.repeat(2001) }),
    })
    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('still sends the support alert when the reporter receipt fails and escapes entities', async () => {
    mocks.user = { ...mocks.user, id: 'person-receipt', email: 'r@example.com' }
    mocks.from.mockReturnValue(query({ data: { id: 'report-2' }, error: null }))
    mocks.sendEmail.mockRejectedValueOnce(new Error('receipt down'))
    const response = await feedbackRouter.request('/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'feature', description: '&lt;a href=x&gt;' }),
    })
    expect(response.status).toBe(201)
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
    expect((mocks.sendEmail.mock.calls[1] as any[])[0].html).toContain('&amp;lt;a href=x&amp;gt;')
  })

  it('rejects expired and tampered resolution tokens', async () => {
    const expired = createResolveToken('report-1', Date.now() - 15 * 24 * 60 * 60 * 1000)
    expect((await feedbackResolutionRouter.request(`/report-1/resolve?token=${expired}`)).status).toBe(403)
    const valid = createResolveToken('report-1')
    expect((await feedbackResolutionRouter.request(`/report-2/resolve?token=${valid}`)).status).toBe(403)
    expect((await feedbackResolutionRouter.request(`/report-1/resolve?token=${valid}`)).status).toBe(200)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  function resolveQuery(results: Record<string, any>) {
    const builder: any = { select: vi.fn(() => builder), update: vi.fn(() => builder), eq: vi.fn(() => builder) }
    let mode = 'select'
    builder.update = vi.fn(() => { mode = 'update'; return builder })
    builder.maybeSingle = vi.fn(async () => results.select)
    builder.then = (resolve: (v: any) => void) => Promise.resolve(results[mode]).then(resolve)
    return builder
  }

  it('retries a lost resolution notification on a resolved report', async () => {
    const reports = resolveQuery({ select: { data: { id: 'report-1', status: 'resolved', reporter_id: 'p1', resolution_sent_at: null }, error: null }, update: { error: null } })
    const profiles = resolveQuery({ select: { data: { email: 'r@example.com', first_name: 'R' }, error: null } })
    mocks.from.mockImplementation((table: string) => (table === 'feedback_reports' ? reports : profiles))
    const response = await feedbackResolutionRouter.request(`/report-1/resolve?token=${createResolveToken('report-1')}`, { method: 'POST' })
    expect(response.status).toBe(200)
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('does not report success when the resolution update or email fails', async () => {
    const token = createResolveToken('report-1')
    const failing = resolveQuery({ select: { data: { id: 'report-1', status: 'open', reporter_id: 'p1', resolution_sent_at: null }, error: null }, update: { error: { message: 'db' } } })
    mocks.from.mockReturnValue(failing)
    expect((await feedbackResolutionRouter.request(`/report-1/resolve?token=${token}`, { method: 'POST' })).status).toBe(503)

    const reports = resolveQuery({ select: { data: { id: 'report-1', status: 'resolved', reporter_id: 'p1', resolution_sent_at: null }, error: null }, update: { error: null } })
    const profiles = resolveQuery({ select: { data: { email: 'r@example.com' }, error: null } })
    mocks.from.mockImplementation((table: string) => (table === 'feedback_reports' ? reports : profiles))
    mocks.sendEmail.mockRejectedValueOnce(new Error('smtp'))
    expect((await feedbackResolutionRouter.request(`/report-1/resolve?token=${token}`, { method: 'POST' })).status).toBe(503)
    expect(reports.update).not.toHaveBeenCalled()
  })
})
