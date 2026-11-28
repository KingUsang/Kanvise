import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, any>,
  writes: [] as Array<{ table: string; op: string; payload: any }>,
  user: { id: 'person-1', school_id: 'legacy', role: 'admin' } as any,
  account: { id: 'account-1', membershipId: 'm-1', role: 'admin' } as any,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const builder: any = {}
      for (const op of ['select', 'eq', 'order', 'limit']) builder[op] = vi.fn(() => builder)
      for (const op of ['upsert', 'update']) {
        builder[op] = vi.fn((payload: any) => {
          mocks.writes.push({ table, op, payload })
          return builder
        })
      }
      const result = () => mocks.tables[table] ?? { data: null, error: null, count: 0 }
      builder.maybeSingle = async () => result()
      builder.then = (resolve: (value: any) => void) => Promise.resolve(result()).then(resolve)
      return builder
    },
  },
}))
vi.mock('../middleware/auth', () => ({
  jwtVerificationMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  profileResolutionMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('user', mocks.user)
    await next()
  },
  accountContextMiddleware: async (c: any, next: () => Promise<void>) => {
    c.set('account', mocks.account)
    await next()
  },
}))

import { onboardingRouter } from './onboarding'

const answers = (overrides: Record<string, unknown> = {}) => ({
  teaching_mode: 'solo', audience: 'children_teens', class_format: 'one_to_one',
  subjects: ['Mathematics'], has_students: true, used_defaults: false, skipped_steps: [], ...overrides,
})

function setup(opts: { role?: 'admin' | 'tutor'; owner?: boolean; accountType?: 'independent' | 'centre'; saved?: any } = {}) {
  const role = opts.role ?? 'admin'
  mocks.user = { id: 'person-1', school_id: 'legacy', role }
  mocks.account = { id: 'account-1', membershipId: 'm-1', role }
  mocks.writes.length = 0
  mocks.tables = {
    account_memberships: { data: { person_id: opts.owner === false ? 'person-0' : 'person-1' }, error: null, count: 2 },
    account_onboarding_answers: { data: opts.saved ?? null, error: null },
    schools: { data: { account_type: opts.accountType ?? 'independent' }, error: null },
    courses: { data: null, error: null, count: 1 },
    live_classes: { data: null, error: null, count: 0 },
  }
}

const json = (body: unknown) => ({ method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('onboarding routes', () => {
  beforeEach(() => setup())

  it('says the account owner still needs to answer', async () => {
    const body = (await (await onboardingRouter.request('/')).json()).data
    expect(body).toMatchObject({ is_owner: true, needs_onboarding: true, answers: null, account_type: 'independent' })
  })

  it('returns saved answers with the lesson length they imply', async () => {
    setup({ saved: answers() })
    const body = (await (await onboardingRouter.request('/')).json()).data
    expect(body.needs_onboarding).toBe(false)
    expect(body.defaults).toEqual({ lesson_minutes: 45 })
  })

  it('lets an invited tutor read the account answers without being asked the questions', async () => {
    setup({ role: 'tutor', saved: answers({ audience: 'adults' }) })
    const body = (await (await onboardingRouter.request('/')).json()).data
    expect(body).toMatchObject({ is_owner: false, needs_onboarding: false })
    expect(body.answers.audience).toBe('adults')
    expect(body.defaults).toEqual({ lesson_minutes: 60 })
  })

  it('saves the answers for an independent tutor and leaves the account name alone', async () => {
    const res = await onboardingRouter.request('/', json({ teaching_mode: 'solo', audience: 'adults', class_format: 'both', subjects: ['Coding'], has_students: false }))
    expect(res.status).toBe(200)
    const upsert = mocks.writes.find((w) => w.op === 'upsert')!
    expect(upsert.payload).toMatchObject({ school_id: 'account-1', audience: 'adults', subjects: ['Coding'], used_defaults: false, answered_by: 'person-1' })
    expect(mocks.writes.some((w) => w.table === 'schools')).toBe(false)
  })

  it('saves a team and renames the agency', async () => {
    setup({ accountType: 'centre' })
    const res = await onboardingRouter.request('/', json({ teaching_mode: 'team', audience: 'both', class_format: 'both', has_students: true, agency_name: 'Science Students Academy' }))
    expect(res.status).toBe(200)
    expect(mocks.writes.find((w) => w.table === 'schools')?.payload).toEqual({ name: 'Science Students Academy' })
  })

  it('requires an agency name for a team (ONB-07)', async () => {
    const res = await onboardingRouter.request('/', json({ teaching_mode: 'team' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('INVALID_AGENCY_NAME')
    expect(mocks.writes).toHaveLength(0)
  })

  it('applies defaults on skip (ONB-09) and flags them', async () => {
    const res = await onboardingRouter.request('/', json({ use_defaults: true }))
    expect((await res.json()).data).toEqual({ saved: true, used_defaults: true })
    expect(mocks.writes[0].payload).toMatchObject({ teaching_mode: 'solo', audience: 'both', class_format: 'both', subjects: [], has_students: false })
  })

  it('keeps steps already skipped when answers are saved again', async () => {
    setup({ saved: answers({ skipped_steps: ['course_plan'] }) })
    await onboardingRouter.request('/', json({ teaching_mode: 'solo', audience: 'both', class_format: 'both', has_students: false }))
    expect(mocks.writes[0].payload.skipped_steps).toEqual(['course_plan'])
  })

  it('refuses answers from a tutor or an admin who did not create the account', async () => {
    setup({ role: 'tutor' })
    expect((await onboardingRouter.request('/', json({ use_defaults: true }))).status).toBe(403)
    setup({ owner: false })
    expect((await onboardingRouter.request('/', json({ use_defaults: true }))).status).toBe(403)
    expect(mocks.writes).toHaveLength(0)
  })

  it('returns setup facts for the owner', async () => {
    setup({ saved: answers({ skipped_steps: ['course_plan'] }) })
    const body = (await (await onboardingRouter.request('/setup')).json()).data
    expect(body).toMatchObject({ eligible: true, account_type: 'independent', skipped_steps: ['course_plan'] })
    expect(body.facts).toEqual({ students: 2, courses: 1, lessons: 0, tutors: 2 })
  })

  it('gives no checklist to invited staff or to an account that never answered', async () => {
    setup({ role: 'tutor', saved: answers() })
    expect((await (await onboardingRouter.request('/setup')).json()).data).toEqual({ eligible: false })
    setup({ owner: false, saved: answers() })
    expect((await (await onboardingRouter.request('/setup')).json()).data).toEqual({ eligible: false })
    setup()
    expect((await (await onboardingRouter.request('/setup')).json()).data).toEqual({ eligible: false })
  })

  it('skips and un-skips only the course plan step', async () => {
    setup({ saved: answers() })
    const post = (body: unknown) => onboardingRouter.request('/setup/skip', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    expect((await (await post({ step: 'course_plan', skipped: true })).json()).data.skipped_steps).toEqual(['course_plan'])
    expect(mocks.writes[0].payload.skipped_steps).toEqual(['course_plan'])
    setup({ saved: answers({ skipped_steps: ['course_plan'] }) })
    expect((await (await post({ step: 'course_plan', skipped: false })).json()).data.skipped_steps).toEqual([])
    expect((await post({ step: 'add_students', skipped: true })).status).toBe(400)
  })

  it('reports a read failure as unavailable instead of an empty setup', async () => {
    setup()
    mocks.tables.account_memberships = { data: null, error: { code: 'XX000' } }
    expect((await onboardingRouter.request('/')).status).toBe(503)
  })
})
