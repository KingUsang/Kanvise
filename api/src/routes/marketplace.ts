import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole } from '../middleware/auth'
import { createPaystackReference, isUuid } from '../payments/checkout'
import type { AppVariables } from '../types'

export const marketplaceRouter = new Hono<{ Variables: AppVariables }>()

const publicListingFields = `id, slug, title, short_description, examination, subjects, tags, difficulty,
  duration_minutes, question_count, total_marks, calculator_mode, result_release_mode, attempts_included,
  pricing_type, price_kobo, currency, approval_status, publication_status, available_from, closes_at, listed_at,
  creator_school:schools!mock_marketplace_listings_creator_school_id_fkey(id, name),
  creator:user_profiles!mock_marketplace_listings_creator_user_id_fkey(id, first_name, last_name)`

function listingAvailable(listing: any, now = new Date()) {
  return listing.approval_status === 'approved' && listing.publication_status === 'listed'
    && (!listing.available_from || now >= new Date(listing.available_from))
    && (!listing.closes_at || now < new Date(listing.closes_at))
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

function creatorCanManage(user: any, listing: any) {
  return user.role === 'admin' ? user.school_id === listing.creator_school_id : user.id === listing.creator_user_id
}

function snapshotFrom(mock: any, version: any) {
  const settings = version.settings || {}
  return {
    title: String(settings.title || mock.title),
    duration_minutes: settings.time_limit_minutes ?? mock.time_limit_minutes ?? null,
    question_count: Number(version.total_questions),
    total_marks: Number(version.total_marks),
    calculator_mode: settings.calculator_mode || mock.calculator_mode || 'none',
    result_release_mode: settings.result_release_mode || mock.result_release_mode || 'score_only',
    attempts_included: Number(settings.max_attempts || mock.max_attempts || 1),
  }
}

function configuredKobo(value: string | undefined, fallback = 0) {
  const number = Number(value ?? fallback)
  return Number.isInteger(number) && number >= 0 ? number : null
}

function marketplacePaymentBreakdown(priceKobo: number) {
  const platformBps = configuredKobo(process.env.MARKETPLACE_PLATFORM_FEE_BPS)
  const processingBps = configuredKobo(process.env.MARKETPLACE_STUDENT_PROCESSING_FEE_BPS)
  const processingFixed = configuredKobo(process.env.MARKETPLACE_STUDENT_PROCESSING_FEE_FIXED_KOBO)
  if (platformBps === null || processingBps === null || processingFixed === null || platformBps > 10_000 || processingBps > 10_000) return null
  const platformFee = Math.round(priceKobo * platformBps / 10_000)
  if (platformFee > priceKobo) return null
  const processingFee = Math.round(priceKobo * processingBps / 10_000) + processingFixed
  return { platformFee, processingFee, total: priceKobo + processingFee, creatorAmount: priceKobo - platformFee }
}

// Safe public catalogue. It intentionally has no question text, answers, or private media keys.
marketplaceRouter.get('/marketplace/mocks', async c => {
  const query = c.req.query()
  const page = Math.max(1, Number(query.page || 1) || 1)
  const pageSize = Math.min(48, Math.max(1, Number(query.page_size || 18) || 18))
  const now = new Date().toISOString()
  let request = supabase.from('mock_marketplace_listings').select(publicListingFields, { count: 'exact' })
    .eq('approval_status', 'approved').eq('publication_status', 'listed')
    .or(`available_from.is.null,available_from.lte.${now}`)
    .or(`closes_at.is.null,closes_at.gt.${now}`)
    .order('listed_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
  if (query.q?.trim()) request = request.ilike('title', `%${query.q.trim().replace(/[%_]/g, '')}%`)
  if (query.examination) request = request.eq('examination', query.examination)
  if (query.subject) request = request.contains('subjects', [query.subject])
  if (query.pricing === 'free' || query.pricing === 'paid') request = request.eq('pricing_type', query.pricing)
  const { data, error, count } = await request
  if (error) return c.json({ error: 'Could not load public mocks' }, 500)
  return c.json({ data: data || [], pagination: { page, page_size: pageSize, total: count || 0 } })
})

marketplaceRouter.get('/marketplace/mocks/:slug', async c => {
  const { data, error } = await supabase.from('mock_marketplace_listings')
    .select(`${publicListingFields}, instructions`)
    .eq('slug', c.req.param('slug')).maybeSingle()
  if (error) return c.json({ error: 'Could not load this mock' }, 500)
  if (!data || !listingAvailable(data)) return c.json({ error: 'Mock not found' }, 404)
  const breakdown = data.pricing_type === 'paid' ? marketplacePaymentBreakdown(Number(data.price_kobo)) : null
  return c.json({ data: {
    ...data,
    checkout_summary: breakdown ? { mock_price_kobo: Number(data.price_kobo), processing_fee_kobo: breakdown.processingFee, total_kobo: breakdown.total } : null,
  } })
})

marketplaceRouter.use('/marketplace/*', jwtVerificationMiddleware, profileResolutionMiddleware)
marketplaceRouter.use('/students/me/marketplace-mocks', jwtVerificationMiddleware, profileResolutionMiddleware)
marketplaceRouter.use('/students/me/purchases', jwtVerificationMiddleware, profileResolutionMiddleware)

marketplaceRouter.post('/marketplace/mocks/:listingId/claim', requireRole('student'), async c => {
  const user = c.get('user')
  const { data, error } = await supabase.rpc('claim_free_marketplace_mock', {
    p_listing_id: c.req.param('listingId'), p_student_id: user.id, p_now: new Date().toISOString(),
  })
  if (error) {
    const unavailable = String(error.message).includes('MARKETPLACE_LISTING_NOT_AVAILABLE')
    return c.json({ error: unavailable ? 'This free mock is not available for claiming' : 'Could not claim this mock', code: unavailable ? 'LISTING_NOT_AVAILABLE' : 'DATABASE_ERROR' }, unavailable ? 409 : 500)
  }
  const row = data?.[0] || data
  return c.json({ data: { entitlement_id: row?.entitlement_id, newly_claimed: row?.newly_claimed === true } }, row?.newly_claimed ? 201 : 200)
})

marketplaceRouter.post('/marketplace/mocks/:listingId/checkout', requireRole('student'), async c => {
  const user = c.get('user')
  const idempotencyKey = c.req.header('Idempotency-Key') || ''
  if (!isUuid(idempotencyKey)) return c.json({ error: 'A valid Idempotency-Key header is required', code: 'INVALID_IDEMPOTENCY_KEY' }, 400)
  const studentEmail = (user as any).email as string | null | undefined
  if (!studentEmail) return c.json({ error: 'Your account needs an email address before checkout', code: 'EMAIL_REQUIRED' }, 400)
  const { data: listing, error: listingError } = await supabase.from('mock_marketplace_listings').select('*').eq('id', c.req.param('listingId')).maybeSingle()
  if (listingError || !listing || !listingAvailable(listing) || listing.pricing_type !== 'paid') return c.json({ error: 'This paid mock is not available', code: 'LISTING_NOT_AVAILABLE' }, 409)
  const { data: existingEntitlement } = await supabase.from('mock_marketplace_entitlements').select('id').eq('student_id', user.id)
    .eq('mock_version_id', listing.mock_version_id).is('revoked_at', null).maybeSingle()
  if (existingEntitlement) return c.json({ error: 'This mock is already in your library', code: 'ALREADY_OWNED' }, 409)
  const { data: existing } = await supabase.from('mock_marketplace_orders').select('id, listing_id, status, paystack_reference, authorization_url, total_charged_kobo, mock_price_kobo, student_processing_fee_kobo')
    .eq('student_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle()
  if (existing) {
    if (existing.listing_id !== listing.id) return c.json({ error: 'This checkout key is already being used for another mock', code: 'IDEMPOTENCY_KEY_REUSED' }, 409)
    if (existing.status === 'pending' && existing.authorization_url) return c.json({ data: { order_id: existing.id, reference: existing.paystack_reference, payment_url: existing.authorization_url, mock_price_kobo: existing.mock_price_kobo, processing_fee_kobo: existing.student_processing_fee_kobo, total_kobo: existing.total_charged_kobo } })
    return c.json({ error: existing.status === 'paid' ? 'Payment already completed' : 'Checkout is no longer available', code: 'CHECKOUT_NOT_AVAILABLE' }, 409)
  }
  const { data: subaccount } = await supabase.from('paystack_subaccounts').select('subaccount_code').eq('school_id', listing.creator_school_id).maybeSingle()
  if (!subaccount?.subaccount_code) return c.json({ error: 'This tutor has not finished setting up paid mock payments', code: 'PAYOUT_NOT_CONFIGURED' }, 409)
  const breakdown = marketplacePaymentBreakdown(Number(listing.price_kobo))
  if (!breakdown) return c.json({ error: 'Marketplace payment configuration is invalid', code: 'PAYMENT_CONFIGURATION_INVALID' }, 503)
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY
  const frontendUrl = process.env.FRONTEND_URL
  if (!paystackSecret || !frontendUrl) return c.json({ error: 'Payments are not configured', code: 'PAYMENTS_NOT_CONFIGURED' }, 503)
  const reference = createPaystackReference()
  const { data: order, error: orderError } = await supabase.from('mock_marketplace_orders').insert({
    student_id: user.id, listing_id: listing.id, mock_version_id: listing.mock_version_id, creator_school_id: listing.creator_school_id,
    paystack_reference: reference, idempotency_key: idempotencyKey, mock_price_kobo: listing.price_kobo,
    student_processing_fee_kobo: breakdown.processingFee, total_charged_kobo: breakdown.total,
    platform_fee_kobo: breakdown.platformFee, creator_amount_kobo: breakdown.creatorAmount,
  }).select().single()
  if (orderError || !order) return c.json({ error: 'Could not start checkout', code: 'CHECKOUT_CREATE_FAILED' }, 500)
  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST', headers: { Authorization: `Bearer ${paystackSecret}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ email: studentEmail, amount: breakdown.total, currency: 'NGN', reference, callback_url: new URL('/payment/return', frontendUrl).toString(),
        subaccount: subaccount.subaccount_code, transaction_charge: breakdown.processingFee + breakdown.platformFee,
        metadata: JSON.stringify({ marketplace_order_id: order.id, listing_id: listing.id, student_id: user.id }), }),
    })
    const payload: any = await response.json()
    if (!response.ok || !payload.status || !payload.data?.authorization_url) throw new Error(payload.message || 'Invalid Paystack response')
    await supabase.from('mock_marketplace_orders').update({ authorization_url: payload.data.authorization_url, updated_at: new Date().toISOString() }).eq('id', order.id)
    return c.json({ data: { order_id: order.id, reference, payment_url: payload.data.authorization_url, mock_price_kobo: listing.price_kobo, processing_fee_kobo: breakdown.processingFee, total_kobo: breakdown.total } }, 201)
  } catch {
    await supabase.from('mock_marketplace_orders').update({ status: 'failed', failed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', order.id)
    return c.json({ error: 'Could not start secure checkout', code: 'PAYSTACK_INITIALIZATION_FAILED' }, 502)
  }
})

marketplaceRouter.get('/marketplace/mocks/:listingId/preflight', requireRole('student'), async c => {
  const user = c.get('user')
  const { data: entitlement, error } = await supabase.from('mock_marketplace_entitlements').select(`
      id, attempts_granted, attempts_consumed,
      listing:mock_marketplace_listings(${publicListingFields}, source_mock_id, mock_version_id)
    `).eq('student_id', user.id).eq('listing_id', c.req.param('listingId')).is('revoked_at', null).maybeSingle()
  if (error) return c.json({ error: 'Could not load mock instructions' }, 500)
  const listing: any = (entitlement as any)?.listing
  if (!entitlement || !listing || !listingAvailable(listing)) return c.json({ error: 'Mock not found', code: 'MOCK_NOT_FOUND' }, 404)
  const { data: attempts } = await supabase.from('mock_attempts').select('id, attempt_number, status, deadline_at, submitted_at')
    .eq('marketplace_entitlement_id', (entitlement as any).id).eq('student_id', user.id)
  const resumable = (attempts || []).find((attempt: any) => attempt.status === 'in_progress' && (!attempt.deadline_at || new Date() < new Date(attempt.deadline_at))) || null
  return c.json({ data: {
    mock: { id: listing.source_mock_id, listing_id: listing.id, title: listing.title, description: listing.short_description,
      time_limit_minutes: listing.duration_minutes, calculator_mode: listing.calculator_mode, result_release_mode: listing.result_release_mode,
      available_from: listing.available_from, closes_at: listing.closes_at, course: null },
    version: { id: listing.mock_version_id, total_questions: listing.question_count, total_marks: listing.total_marks },
    availability: 'open', attempts_used: (entitlement as any).attempts_consumed, attempts_allowed: (entitlement as any).attempts_granted,
    resumable_attempt: resumable,
  }, server_now: new Date().toISOString() })
})

marketplaceRouter.post('/marketplace/mocks/:listingId/attempts', requireRole('student'), async c => {
  const user = c.get('user')
  const { data, error } = await supabase.rpc('start_or_resume_marketplace_mock_attempt', {
    p_listing_id: c.req.param('listingId'), p_student_id: user.id, p_now: new Date().toISOString(),
  })
  if (error) {
    const message = String(error.message || '')
    const code = message.includes('ENTITLEMENT') ? 'MARKETPLACE_ENTITLEMENT_NOT_FOUND'
      : message.includes('ATTEMPT_LIMIT') ? 'ATTEMPT_LIMIT_REACHED'
        : message.includes('LISTING_NOT_AVAILABLE') ? 'MARKETPLACE_LISTING_NOT_AVAILABLE' : 'DATABASE_ERROR'
    return c.json({ error: code.replaceAll('_', ' ').toLowerCase(), code }, code === 'DATABASE_ERROR' ? 500 : 409)
  }
  return c.json({ data: data?.[0] || data, server_now: new Date().toISOString() }, 201)
})

marketplaceRouter.get('/students/me/marketplace-mocks', requireRole('student'), async c => {
  const user = c.get('user')
  const { data, error } = await supabase.from('mock_marketplace_entitlements').select(`
      id, attempts_granted, attempts_consumed, granted_at, expires_at,
      listing:mock_marketplace_listings(${publicListingFields})
    `).eq('student_id', user.id).is('revoked_at', null).order('granted_at', { ascending: false })
  if (error) return c.json({ error: 'Could not load your marketplace mocks' }, 500)
  return c.json({ data: (data || []).filter((item: any) => item.listing) })
})

marketplaceRouter.get('/students/me/purchases', requireRole('student'), async c => {
  const user = c.get('user')
  const { data, error } = await supabase.from('mock_marketplace_orders').select(`
      id, paystack_reference, mock_price_kobo, student_processing_fee_kobo, total_charged_kobo,
      currency, status, created_at, paid_at, listing:mock_marketplace_listings(title, slug)
    `).eq('student_id', user.id).order('created_at', { ascending: false })
  if (error) return c.json({ error: 'Could not load purchases' }, 500)
  return c.json({ data: data || [] })
})

// The browser return page can poll this owner-only status endpoint. It never
// creates entitlements; confirmation still happens through verified Paystack.
marketplaceRouter.get('/marketplace/orders/:reference', requireRole('student'), async c => {
  const user = c.get('user')
  const { data, error } = await supabase.from('mock_marketplace_orders')
    .select('paystack_reference, status, total_charged_kobo, paid_at, listing:mock_marketplace_listings(title)')
    .eq('paystack_reference', c.req.param('reference')).eq('student_id', user.id).maybeSingle()
  if (error) return c.json({ error: 'Could not load order status' }, 500)
  if (!data) return c.json({ error: 'Marketplace order not found', code: 'ORDER_NOT_FOUND' }, 404)
  return c.json({ data })
})

marketplaceRouter.get('/marketplace/creator/listings', requireRole('admin', 'tutor'), async c => {
  const user = c.get('user')
  if (!user.school_id) return c.json({ error: 'A teaching centre is required to manage listings' }, 403)
  let request = supabase.from('mock_marketplace_listings').select(`${publicListingFields}, approval_status, publication_status, rejection_reason, source_mock_id, mock_version_id, created_at`)
    .eq('creator_school_id', user.school_id).order('created_at', { ascending: false })
  if (user.role === 'tutor') request = request.eq('creator_user_id', user.id)
  const { data, error } = await request
  if (error) return c.json({ error: 'Could not load creator listings' }, 500)
  return c.json({ data: data || [] })
})

marketplaceRouter.post('/marketplace/creator/listings', requireRole('admin', 'tutor'), async c => {
  const user = c.get('user')
  if (!user.school_id) return c.json({ error: 'A teaching centre is required to create a listing' }, 403)
  const body = await c.req.json()
  if (typeof body.source_mock_id !== 'string' || typeof body.title !== 'string') return c.json({ error: 'A published mock and public title are required' }, 400)
  const { data: mock, error: mockError } = await supabase.from('mock_exams')
    .select('id, school_id, tutor_id, status, title, time_limit_minutes, calculator_mode, result_release_mode, max_attempts')
    .eq('id', body.source_mock_id).eq('school_id', user.school_id).maybeSingle()
  if (mockError || !mock || mock.status !== 'published' || (user.role === 'tutor' && mock.tutor_id !== user.id)) return c.json({ error: 'Choose one of your published mocks' }, 400)
  const { data: version } = await supabase.from('mock_exam_versions').select('id, settings, total_questions, total_marks')
    .eq('mock_exam_id', mock.id).order('version_number', { ascending: false }).limit(1).maybeSingle()
  if (!version) return c.json({ error: 'This mock does not have a published version yet' }, 409)
  const snapshot = snapshotFrom(mock, version)
  const title = body.title.trim()
  const slugBase = slugify(body.slug || title)
  if (!slugBase) return c.json({ error: 'Use a title containing letters or numbers' }, 400)
  const suffix = Math.random().toString(36).slice(2, 7)
  const insert = {
    creator_school_id: user.school_id, creator_user_id: mock.tutor_id, source_mock_id: mock.id, mock_version_id: version.id,
    ...snapshot, slug: `${slugBase}-${suffix}`, title, short_description: String(body.short_description || '').trim(),
    examination: body.examination || null, subjects: Array.isArray(body.subjects) ? body.subjects.filter((value: unknown) => typeof value === 'string').slice(0, 12) : [],
    tags: Array.isArray(body.tags) ? body.tags.filter((value: unknown) => typeof value === 'string').slice(0, 12) : [],
    difficulty: ['beginner', 'intermediate', 'advanced'].includes(body.difficulty) ? body.difficulty : null,
    instructions: typeof body.instructions === 'string' ? body.instructions.trim() : null,
    pricing_type: body.pricing_type === 'paid' ? 'paid' : 'free', price_kobo: body.pricing_type === 'paid' ? Number(body.price_kobo) : 0,
    available_from: body.available_from || null, closes_at: body.closes_at || null,
    rights_confirmed_at: body.rights_confirmed === true ? new Date().toISOString() : null,
  }
  if (insert.pricing_type === 'paid' && (!Number.isInteger(insert.price_kobo) || insert.price_kobo < 100)) return c.json({ error: 'Set a valid price in kobo' }, 400)
  const { data, error } = await supabase.from('mock_marketplace_listings').insert(insert).select().single()
  if (error) return c.json({ error: 'Could not create this listing' }, 500)
  await supabase.from('mock_marketplace_creator_events').insert({ listing_id: data.id, actor_id: user.id, action: 'created' })
  return c.json({ data }, 201)
})

marketplaceRouter.post('/marketplace/creator/listings/:listingId/submit', requireRole('admin', 'tutor'), async c => {
  const user = c.get('user')
  const { data: listing } = await supabase.from('mock_marketplace_listings').select('*').eq('id', c.req.param('listingId')).maybeSingle()
  if (!listing || !creatorCanManage(user, listing)) return c.json({ error: 'Listing not found' }, 404)
  if (!listing.rights_confirmed_at) return c.json({ error: 'Confirm you have the right to publish this content first' }, 400)
  const isAdmin = user.role === 'admin'
  const update = isAdmin
    ? { approval_status: 'approved', publication_status: 'listed', approved_by: user.id, approved_at: new Date().toISOString(), listed_at: new Date().toISOString() }
    : { approval_status: 'submitted', submitted_at: new Date().toISOString() }
  const { data, error } = await supabase.from('mock_marketplace_listings').update(update).eq('id', listing.id).select().single()
  if (error) return c.json({ error: 'Could not submit this listing' }, 500)
  await supabase.from('mock_marketplace_creator_events').insert({ listing_id: listing.id, actor_id: user.id, action: isAdmin ? 'listed' : 'submitted' })
  return c.json({ data, message: isAdmin ? 'Your mock is now listed publicly' : 'Submitted for centre-admin approval' })
})

marketplaceRouter.post('/marketplace/creator/listings/:listingId/approve', requireRole('admin'), async c => {
  const user = c.get('user')
  const { data: listing } = await supabase.from('mock_marketplace_listings').select('*').eq('id', c.req.param('listingId')).maybeSingle()
  if (!listing || listing.creator_school_id !== user.school_id) return c.json({ error: 'Listing not found' }, 404)
  if (listing.approval_status !== 'submitted') return c.json({ error: 'Only submitted listings can be approved' }, 409)
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('mock_marketplace_listings').update({ approval_status: 'approved', publication_status: 'listed', approved_by: user.id, approved_at: now, listed_at: now, rejection_reason: null }).eq('id', listing.id).select().single()
  if (error) return c.json({ error: 'Could not approve this listing' }, 500)
  await supabase.from('mock_marketplace_creator_events').insert({ listing_id: listing.id, actor_id: user.id, action: 'approved' })
  return c.json({ data })
})

marketplaceRouter.post('/marketplace/creator/listings/:listingId/withdraw', requireRole('admin', 'tutor'), async c => {
  const user = c.get('user')
  const { data: listing } = await supabase.from('mock_marketplace_listings').select('*').eq('id', c.req.param('listingId')).maybeSingle()
  if (!listing || !creatorCanManage(user, listing)) return c.json({ error: 'Listing not found' }, 404)
  const { data, error } = await supabase.from('mock_marketplace_listings').update({ publication_status: 'withdrawn', withdrawn_at: new Date().toISOString() }).eq('id', listing.id).select().single()
  if (error) return c.json({ error: 'Could not withdraw this listing' }, 500)
  await supabase.from('mock_marketplace_creator_events').insert({ listing_id: listing.id, actor_id: user.id, action: 'withdrawn' })
  return c.json({ data })
})
