import { Hono } from 'hono'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import {
  accountContextMiddleware,
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
} from '../middleware/auth'
import { defaultLessonMinutes, onboardingBodySchema, resolveOnboardingAnswers, SKIPPABLE_STEPS, type Audience } from '../lib/onboarding'
import type { AccountContext, AppVariables } from '../types'

export const onboardingRouter = new Hono<{ Variables: AppVariables }>()

onboardingRouter.use('*', jwtVerificationMiddleware)
onboardingRouter.use('*', profileResolutionMiddleware)
onboardingRouter.use('*', accountContextMiddleware)

const db = supabase as any
const unavailable = (c: any) => c.json({ error: 'We could not load your setup right now. Please try again.', code: 'ONBOARDING_UNAVAILABLE' }, 503)

/**
 * Only the admin who created the account answers the questions and sees the
 * checklist (02 Permissions): the earliest active admin membership. Invited
 * tutors and admins only read the account's answers.
 */
async function isAccountOwner(account: AccountContext, personId: string): Promise<boolean | null> {
  if (account.role !== 'admin') return false
  const { data, error } = await db
    .from('account_memberships')
    .select('person_id')
    .eq('school_id', account.id)
    .eq('role', 'admin')
    .eq('status', 'active')
    .order('joined_at', { ascending: true })
    .order('person_id', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data?.person_id === personId
}

async function loadAnswers(schoolId: string) {
  const { data, error } = await db
    .from('account_onboarding_answers')
    .select('teaching_mode, audience, class_format, subjects, has_students, used_defaults, skipped_steps')
    .eq('school_id', schoolId)
    .maybeSingle()
  return { answers: data ?? null, error }
}

async function loadAccountType(schoolId: string) {
  const { data, error } = await db.from('schools').select('account_type').eq('id', schoolId).maybeSingle()
  return { accountType: data?.account_type === 'independent' ? 'independent' : 'centre', error }
}

// ONB-02..ONB-10: the account's answers. Everyone in the account can read them
// (an invited tutor inherits them); `needs_onboarding` is true only for the owner.
onboardingRouter.get('/', async (c) => {
  const user = c.get('user')
  const account = c.get('account') as AccountContext
  const [owner, loaded, type] = await Promise.all([isAccountOwner(account, user.id), loadAnswers(account.id), loadAccountType(account.id)])
  if (owner === null || loaded.error || type.error) return unavailable(c)
  const answers = loaded.answers
  return c.json({
    data: {
      is_owner: owner,
      account_type: type.accountType,
      needs_onboarding: owner && !answers,
      answers,
      defaults: answers ? { lesson_minutes: defaultLessonMinutes(answers.audience as Audience) } : null,
    },
  })
})

// ONB-08: save the answers. Unanswered questions take the ONB-09 defaults.
onboardingRouter.put('/', async (c) => {
  const user = c.get('user')
  const account = c.get('account') as AccountContext
  const owner = await isAccountOwner(account, user.id)
  if (owner === null) return unavailable(c)
  if (!owner) return c.json({ error: 'Only the person who created this account can answer these questions', code: 'INSUFFICIENT_ROLE' }, 403)

  const parsed = onboardingBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    return c.json({ error: field === 'agency_name' ? "Add your agency's name." : 'Check your answers and try again', code: field === 'agency_name' ? 'INVALID_AGENCY_NAME' : 'VALIDATION_ERROR' }, 400)
  }
  const body = parsed.data
  const resolved = resolveOnboardingAnswers(body)
  if (resolved.teaching_mode === 'team' && !body.use_defaults && !body.agency_name) {
    return c.json({ error: "Add your agency's name.", code: 'INVALID_AGENCY_NAME' }, 400)
  }

  // A repeat save keeps any step the owner already skipped.
  const existing = await loadAnswers(account.id)
  if (existing.error) return unavailable(c)
  const { error } = await db.from('account_onboarding_answers').upsert({
    school_id: account.id,
    ...resolved,
    skipped_steps: existing.answers?.skipped_steps ?? [],
    answered_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'school_id' })
  if (error) {
    console.error('[onboarding] Saving answers failed', { code: error.code })
    return unavailable(c)
  }

  // ONB-07: a team's name is what tutors and students see. An independent
  // account keeps the name it was created with.
  if (resolved.teaching_mode === 'team' && body.agency_name && !body.use_defaults) {
    const type = await loadAccountType(account.id)
    if (!type.error && type.accountType === 'centre') {
      const { error: nameError } = await db.from('schools').update({ name: body.agency_name }).eq('id', account.id)
      if (nameError) console.error('[onboarding] Agency name update failed', { code: nameError.code })
    }
  }

  return c.json({ data: { saved: true, used_defaults: resolved.used_defaults } })
})

async function countRows(table: string, schoolId: string, filter?: (query: any) => any) {
  let query = db.from(table).select('*', { count: 'exact', head: true }).eq('school_id', schoolId)
  if (filter) query = filter(query)
  const { count, error } = await query
  return error ? null : (count ?? 0)
}

// SET-01, SET-02: what the checklist is worked out from. Rows are decided in
// the web app; this returns the facts. Invited tutors and admins have no list.
onboardingRouter.get('/setup', async (c) => {
  const user = c.get('user')
  const account = c.get('account') as AccountContext
  const owner = await isAccountOwner(account, user.id)
  if (owner === null) return unavailable(c)
  if (!owner) return c.json({ data: { eligible: false } })

  const [loaded, type] = await Promise.all([loadAnswers(account.id), loadAccountType(account.id)])
  if (loaded.error || type.error) return unavailable(c)
  // An account that never answered the questions has no checklist.
  if (!loaded.answers) return c.json({ data: { eligible: false } })

  const [students, courses, lessons, tutors] = await Promise.all([
    // Real students only. Sample data does not exist yet; when it does it must be excluded here.
    countRows('account_memberships', account.id, (q) => q.eq('role', 'learner').eq('status', 'active')),
    countRows('courses', account.id),
    countRows('live_classes', account.id, (q) => q.eq('status', 'scheduled')),
    countRows('account_memberships', account.id, (q) => q.eq('role', 'tutor').eq('status', 'active')),
  ])
  return c.json({
    data: {
      eligible: true,
      account_type: type.accountType,
      has_students_answer: loaded.answers.has_students === true,
      skipped_steps: loaded.answers.skipped_steps ?? [],
      // null means that count could not be read; the row stays unticked.
      facts: { students, courses, lessons, tutors },
    },
  })
})

const skipSchema = z.object({ step: z.enum(SKIPPABLE_STEPS), skipped: z.boolean() }).strict()

// SET-01 rules: only the course plan step can be skipped, and undone.
onboardingRouter.post('/setup/skip', async (c) => {
  const user = c.get('user')
  const account = c.get('account') as AccountContext
  const owner = await isAccountOwner(account, user.id)
  if (owner === null) return unavailable(c)
  if (!owner) return c.json({ error: 'Only the person who created this account can change setup', code: 'INSUFFICIENT_ROLE' }, 403)
  const parsed = skipSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Only the course plan step can be skipped', code: 'VALIDATION_ERROR' }, 400)

  const loaded = await loadAnswers(account.id)
  if (loaded.error) return unavailable(c)
  if (!loaded.answers) return c.json({ error: 'Answer the setup questions first', code: 'ONBOARDING_REQUIRED' }, 409)
  const current: string[] = loaded.answers.skipped_steps ?? []
  const next = parsed.data.skipped
    ? Array.from(new Set([...current, parsed.data.step]))
    : current.filter((step) => step !== parsed.data.step)
  const { error } = await db.from('account_onboarding_answers').update({ skipped_steps: next, updated_at: new Date().toISOString() }).eq('school_id', account.id)
  if (error) return unavailable(c)
  return c.json({ data: { skipped_steps: next } })
})
