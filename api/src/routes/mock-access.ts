import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, tenantMiddleware } from '../middleware/auth'
import { createPaystackReference, isUuid } from '../payments/checkout'
import type { AppVariables, TenantVariables } from '../types'

export const mockAccessRouter = new Hono<{ Variables: AppVariables }>()
export const mockOfferAdminRouter = new Hono<{ Variables: TenantVariables }>()

const db = supabase as any
const publicOfferFields = `id, slug, audience_scope, access_mode, price_kobo, currency, attempts_included, available_from, closes_at,
  mock:mock_exams(id, title, description, time_limit_minutes, calculator_mode, result_release_mode, school:schools(name)),
  version:mock_exam_versions(id, total_questions, total_marks, settings)`

function isOpen(offer: any, now = new Date()) {
  return offer?.is_active && (!offer.available_from || now >= new Date(offer.available_from))
    && (!offer.closes_at || now < new Date(offer.closes_at))
}

function offerVisibleToAnonymous(offer: any) {
  return offer?.audience_scope === 'public_link' && isOpen(offer)
}

async function loadOffer(idOrSlug: string, bySlug = false) {
  let request = db.from('mock_access_offers').select(`${publicOfferFields}, is_active, school_id, mock_exam_id, mock_exam_version_id`)
  request = bySlug ? request.eq('slug', idOrSlug) : request.eq('id', idOrSlug)
  const { data, error } = await request.maybeSingle()
  if (error) throw error
  return data
}

async function canUseOffer(studentId: string, offer: any) {
  if (!isOpen(offer)) return false
  if (offer.audience_scope === 'public_link') return true
  if (offer.audience_scope === 'selected_students') {
    const { data } = await db.from('mock_access_offer_students').select('offer_id').eq('offer_id', offer.id).eq('student_id', studentId).maybeSingle()
    return !!data
  }
  if (offer.audience_scope === 'school') {
    const { data } = await db.from('student_centre_memberships').select('id').eq('student_id', studentId).eq('school_id', offer.school_id).eq('status', 'active').maybeSingle()
    return !!data
  }
  if (offer.audience_scope === 'programme') {
    const { data } = await db.from('enrolments').select('id').eq('student_id', studentId).eq('programme_id', offer.programme_id).eq('status', 'active').maybeSingle()
    return !!data
  }
  if (offer.audience_scope === 'course') {
    const { data } = await db.from('enrolments').select('id').eq('student_id', studentId).eq('course_id', offer.course_id).eq('status', 'active').maybeSingle()
    return !!data
  }
  return false
}

mockAccessRouter.get('/mock/:slug', async c => {
  try {
    const offer = await loadOffer(c.req.param('slug')!, true)
    if (!offer || !offerVisibleToAnonymous(offer)) return c.json({ error: 'Mock not found' }, 404)
    return c.json({ data: offer })
  } catch { return c.json({ error: 'Could not load this mock' }, 500) }
})

mockAccessRouter.use('/mock/*', jwtVerificationMiddleware, profileResolutionMiddleware)
mockAccessRouter.use('/my-mocks', jwtVerificationMiddleware, profileResolutionMiddleware)

mockAccessRouter.post('/mock/:offerId/claim', requireRole('student'), async c => {
  const user = c.get('user'); const offer = await loadOffer(c.req.param('offerId')!)
  if (!offer || offer.access_mode !== 'free_claim' || !(await canUseOffer(user.id, offer))) return c.json({ error: 'This mock is not available to you' }, 409)
  const { data, error } = await db.rpc('claim_free_mock_offer', { p_offer_id: offer.id, p_student_id: user.id, p_now: new Date().toISOString() })
  if (error) return c.json({ error: 'Could not claim this mock' }, 409)
  const result = data?.[0] || data
  return c.json({ data: { entitlement_id: result?.entitlement_id, newly_claimed: result?.newly_claimed === true } }, result?.newly_claimed ? 201 : 200)
})

mockAccessRouter.post('/mock/:offerId/checkout', requireRole('student'), async c => {
  const user = c.get('user'); const idempotencyKey = c.req.header('Idempotency-Key') || ''
  if (!isUuid(idempotencyKey)) return c.json({ error: 'A valid Idempotency-Key header is required' }, 400)
  const { data: studentProfile, error: profileError } = await supabase.from('user_profiles').select('email').eq('id', user.id).maybeSingle()
  const studentEmail = studentProfile?.email || null
  if (profileError || !studentEmail) return c.json({ error: 'Your account needs an email address before checkout' }, 400)
  const offer = await loadOffer(c.req.param('offerId')!)
  if (!offer || offer.access_mode !== 'paid' || !(await canUseOffer(user.id, offer))) return c.json({ error: 'This paid mock is not available to you' }, 409)
  const { data: entitlement } = await db.from('mock_entitlements').select('id').eq('student_id', user.id).eq('offer_id', offer.id).is('revoked_at', null).maybeSingle()
  if (entitlement) return c.json({ error: 'This mock is already in your library' }, 409)
  const { data: existing } = await db.from('mock_orders').select('*').eq('student_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle()
  if (existing) {
    if (existing.offer_id !== offer.id) return c.json({ error: 'This checkout key is already being used for another mock' }, 409)
    if (existing.status === 'pending' && existing.authorization_url) return c.json({ data: { order_id: existing.id, reference: existing.paystack_reference, payment_url: existing.authorization_url } })
    return c.json({ error: 'Checkout is no longer available' }, 409)
  }
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY; const frontendUrl = process.env.FRONTEND_URL
  if (!paystackSecret || !frontendUrl) return c.json({ error: 'Payments are not configured' }, 503)
  const reference = createPaystackReference()
  const { data: order, error } = await db.from('mock_orders').insert({ student_id: user.id, offer_id: offer.id, mock_exam_version_id: offer.mock_exam_version_id, paystack_reference: reference, idempotency_key: idempotencyKey, amount_kobo: offer.price_kobo }).select().single()
  if (error || !order) return c.json({ error: 'Could not start checkout' }, 500)
  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${paystackSecret}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000), body: JSON.stringify({ email: studentEmail, amount: offer.price_kobo, currency: 'NGN', reference, callback_url: new URL('/payment/return', frontendUrl).toString(), metadata: JSON.stringify({ mock_order_id: order.id, offer_id: offer.id, student_id: user.id }) }) })
    const payload: any = await response.json(); if (!response.ok || !payload.status || !payload.data?.authorization_url) throw new Error('Invalid Paystack response')
    await db.from('mock_orders').update({ authorization_url: payload.data.authorization_url, updated_at: new Date().toISOString() }).eq('id', order.id)
    return c.json({ data: { order_id: order.id, reference, payment_url: payload.data.authorization_url } }, 201)
  } catch {
    await db.from('mock_orders').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', order.id)
    return c.json({ error: 'Could not start secure checkout' }, 502)
  }
})

mockAccessRouter.get('/mock/:offerId/preflight', requireRole('student'), async c => {
  const user = c.get('user'); const offer = await loadOffer(c.req.param('offerId')!)
  if (!offer || !(await canUseOffer(user.id, offer))) return c.json({ error: 'Mock not found' }, 404)
  const { data: entitlement } = await db.from('mock_entitlements').select('id, attempts_granted, attempts_consumed, expires_at').eq('student_id', user.id).eq('offer_id', offer.id).is('revoked_at', null).maybeSingle()
  if (!entitlement || (entitlement.expires_at && new Date(entitlement.expires_at) <= new Date())) return c.json({ error: 'Get access to this mock first', code: 'MOCK_ENTITLEMENT_NOT_FOUND' }, 403)
  const { data: attempts } = await db.from('mock_attempts').select('id, attempt_number, status, deadline_at').eq('student_id', user.id).eq('entitlement_id', entitlement.id)
  return c.json({ data: { offer, attempts_used: entitlement.attempts_consumed, attempts_allowed: entitlement.attempts_granted, resumable_attempt: (attempts || []).find((item: any) => item.status === 'in_progress' && (!item.deadline_at || new Date() < new Date(item.deadline_at))) || null }, server_now: new Date().toISOString() })
})

mockAccessRouter.post('/mock/:offerId/attempts', requireRole('student'), async c => {
  const user = c.get('user'); const { data, error } = await db.rpc('start_or_resume_mock_offer_attempt', { p_offer_id: c.req.param('offerId')!, p_student_id: user.id, p_now: new Date().toISOString() })
  if (error) return c.json({ error: String(error.message || 'Could not start the mock'), code: 'ATTEMPT_START_FAILED' }, 409)
  return c.json({ data: data?.[0] || data, server_now: new Date().toISOString() }, 201)
})

mockAccessRouter.get('/my-mocks', requireRole('student'), async c => {
  const user = c.get('user')
  const { data, error } = await db.from('mock_entitlements').select(`id, attempts_granted, attempts_consumed, granted_at, expires_at, offer:mock_access_offers(${publicOfferFields})`).eq('student_id', user.id).is('revoked_at', null).order('granted_at', { ascending: false })
  if (error) return c.json({ error: 'Could not load your mocks' }, 500)
  return c.json({ data: data || [] })
})

mockAccessRouter.get('/mock/orders/:reference', requireRole('student'), async c => {
  const user = c.get('user')
  const { data, error } = await db.from('mock_orders').select('paystack_reference, status, amount_kobo, paid_at, offer:mock_access_offers(slug, mock:mock_exams(title))')
    .eq('student_id', user.id).eq('paystack_reference', c.req.param('reference')!).maybeSingle()
  if (error) return c.json({ error: 'Could not load mock payment status' }, 500)
  if (!data) return c.json({ error: 'Mock order not found' }, 404)
  return c.json({ data })
})

mockOfferAdminRouter.use('*', jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, requireRole('admin', 'tutor'))
mockOfferAdminRouter.get('/:mockId/offers', async c => {
  const user = c.get('user'); const mockId = c.req.param('mockId')!
  const [{ data, error }, { data: versions, error: versionError }] = await Promise.all([
    db.from('mock_access_offers').select('*').eq('school_id', user.school_id).eq('mock_exam_id', mockId).order('created_at', { ascending: false }),
    db.from('mock_exam_versions').select('id, version_number, total_questions').eq('school_id', user.school_id).eq('mock_exam_id', mockId).order('version_number', { ascending: false }),
  ])
  if (error || versionError) return c.json({ error: 'Could not load mock offers' }, 500); return c.json({ data: data || [], versions: versions || [] })
})
mockOfferAdminRouter.post('/:mockId/offers', async c => {
  const user = c.get('user'); const body = await c.req.json(); const slug = String(body.slug || '').toLowerCase().trim()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return c.json({ error: 'Use a lowercase URL slug with letters, numbers and hyphens only' }, 400)
  const { data: version } = await db.from('mock_exam_versions').select('id').eq('id', body.mock_exam_version_id).eq('mock_exam_id', c.req.param('mockId')!).eq('school_id', user.school_id).maybeSingle()
  if (!version) return c.json({ error: 'Choose a published mock version' }, 400)
  const payload = { school_id: user.school_id, created_by: user.id, mock_exam_id: c.req.param('mockId')!, mock_exam_version_id: version.id, slug, audience_scope: body.audience_scope || 'public_link', course_id: body.course_id || null, programme_id: body.programme_id || null, access_mode: body.access_mode || 'free_claim', price_kobo: Number(body.price_kobo || 0), attempts_included: Number(body.attempts_included || 1), available_from: body.available_from || null, closes_at: body.closes_at || null, expires_after_days: body.expires_after_days || null, is_active: body.is_active !== false }
  const { data, error } = await db.from('mock_access_offers').insert(payload).select().single()
  if (error) return c.json({ error: error.code === '23505' ? 'That URL slug is already in use' : 'Could not create mock offer' }, 400)
  const studentIds = Array.isArray(body.student_ids) ? body.student_ids.filter((studentId: unknown): studentId is string => typeof studentId === 'string') : []
  if (payload.audience_scope === 'selected_students' && studentIds.length) await db.from('mock_access_offer_students').insert(studentIds.map(student_id => ({ offer_id: data.id, student_id })))
  return c.json({ data }, 201)
})
