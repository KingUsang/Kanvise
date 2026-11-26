import { createHmac, timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import * as Sentry from '@sentry/node'
import { supabase } from '../lib/supabase'
import {
  accountContextMiddleware,
  jwtVerificationMiddleware,
  profileResolutionMiddleware,
  requireMembershipRole,
} from '../middleware/auth'
import { getEmailConfig } from '../emails/config'
import { sendEmail } from '../emails/provider-router'
import type { AccountContext, AppVariables } from '../types'
import { buildPrivateFileKey, createPresignedDownload, uploadPrivateObject, validatePrivateUploadMetadata } from '../storage/r2'

export const feedbackRouter = new Hono<{ Variables: AppVariables }>()
const recent = new Map<string, number>()

function supportEmail() { return process.env.SUPPORT_EMAIL?.trim() || 'hello@kanvise.com' }
const RESOLVE_TTL_MS = 14 * 24 * 60 * 60 * 1000
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
const MAX_SCREENSHOT_ENCODED_LENGTH = Math.ceil(MAX_SCREENSHOT_BYTES / 3) * 4
const MAX_REQUEST_BYTES = MAX_SCREENSHOT_ENCODED_LENGTH + 64 * 1024
const MAX_ATTEMPTED_ACTION_LENGTH = 2000
function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function resolveSignature(id: string, expires: number) { return createHmac('sha256', process.env.KANVISE_INTERNAL_SECRET || '').update(`feedback:${id}:${expires}`).digest('hex') }
export function createResolveToken(id: string, now = Date.now()) { const expires = now + RESOLVE_TTL_MS; return `${expires}.${resolveSignature(id, expires)}` }
export function isValidResolveToken(id: string, token: string, now = Date.now()) {
  if (!process.env.KANVISE_INTERNAL_SECRET) return false
  const [expiresText, signature, ...rest] = token.split('.')
  const expires = Number(expiresText)
  if (rest.length || !signature || !Number.isSafeInteger(expires) || expires <= now) return false
  return safeEqual(signature, resolveSignature(id, expires))
}
function safeEqual(a: string, b: string) { return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)) }
function resolveOrigin(requestOrigin: string) {
  const configured = process.env.API_PUBLIC_URL?.trim()
  if (configured) { try { const url = new URL(configured); if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin } catch { /* fall through */ } }
  return requestOrigin
}
function resolveUrl(origin: string, id: string) { return `${resolveOrigin(origin).replace(/\/$/, '')}/support/feedback/${id}/resolve?token=${createResolveToken(id)}` }

async function sendReceipt(report: any, user: any) {
  const config = getEmailConfig()
  const ref = `KAN-${report.id.slice(0, 8).toUpperCase()}`
  const isBug = report.kind === 'bug'
  const message = isBug ? 'We’ve received your report and will get back to you shortly.' : 'We’ve received your suggestion and will get back to you shortly.'
  await sendEmail({ from: config.from, to: [user.email], replyTo: supportEmail(), subject: `${isBug ? 'We received your report' : 'We received your suggestion'} (${ref})`, html: `<p>Hello ${escapeHtml(user.first_name || 'there')},</p><p>${message}</p><p>Reference: <strong>${ref}</strong></p>`, text: `${message} Reference: ${ref}` }, { event: 'feedback_receipt', idempotencyKey: `feedback-receipt:${report.id}` })
}

feedbackRouter.use('/*', jwtVerificationMiddleware, profileResolutionMiddleware)
feedbackRouter.use('/*', accountContextMiddleware)
feedbackRouter.use('/*', async (c, next) => {
  const account = c.get('account') as AccountContext | undefined
  if (!account) return c.json({ error: 'Tutoring account context is required', code: 'ACCOUNT_CONTEXT_REQUIRED' }, 400)
  const user = c.get('user')
  c.set('user', {
    ...user,
    school_id: account.id,
    role: account.role === 'learner' ? 'student' : account.role,
  })
  await next()
})

feedbackRouter.post('/', requireMembershipRole('admin', 'tutor', 'learner'), async c => {
  const user = c.get('user') as any
  const declaredLength = Number(c.req.header('content-length') || 0)
  if (declaredLength > MAX_REQUEST_BYTES) return c.json({ error: 'That report is too large.', code: 'PAYLOAD_TOO_LARGE' }, 413)
  const body = await c.req.json().catch(() => null) as any
  const kind = body?.kind === 'bug' || body?.kind === 'feature' ? body.kind : null
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  const attemptedAction = typeof body?.attempted_action === 'string' ? body.attempted_action.trim() : null
  const severity = kind === 'bug' && ['blocking', 'major', 'minor'].includes(body?.severity) ? body.severity : null
  if (!kind || !description || description.length > 4000 || (attemptedAction?.length || 0) > MAX_ATTEMPTED_ACTION_LENGTH || (kind === 'bug' && !severity)) return c.json({ error: 'Please complete the report details.', code: 'VALIDATION_ERROR' }, 400)

  // Validate and decode the screenshot before any row is written, enforcing the encoded size first.
  let screenshot: { buffer: Buffer; contentType: string; extension: string } | null = null
  if (body?.screenshot) {
    try {
      const shot = body.screenshot
      if (typeof shot.name !== 'string' || typeof shot.content_type !== 'string' || typeof shot.data !== 'string') throw new Error('invalid screenshot')
      if (shot.data.length > MAX_SCREENSHOT_ENCODED_LENGTH) throw new Error('screenshot too large')
      const buffer = Buffer.from(shot.data, 'base64')
      const metadata = validatePrivateUploadMetadata({ entityType: 'feedback_screenshot', fileName: shot.name, contentType: shot.content_type, fileSizeBytes: buffer.length })
      screenshot = { buffer, contentType: shot.content_type, extension: metadata.extension }
    } catch { return c.json({ error: 'We could not attach that screenshot. Please send the report again without it.', code: 'SCREENSHOT_FAILED' }, 400) }
  }

  const now = Date.now(); if ((recent.get(user.id) || 0) > now - 60_000) return c.json({ error: 'Please wait a moment before sending another report.', code: 'RATE_LIMITED' }, 429)
  for (const [key, at] of recent) if (at <= now - 60_000) recent.delete(key)
  recent.set(user.id, now)
  const { data: report, error } = await (supabase as any).from('feedback_reports').insert({ reporter_id: user.id, school_id: user.school_id || null, kind, severity, description, attempted_action: attemptedAction || null, page_url: typeof body.page_url === 'string' ? body.page_url.slice(0, 2000) : null, user_agent: c.req.header('user-agent')?.slice(0, 512) || null, sentry_event_id: typeof body.sentry_event_id === 'string' ? body.sentry_event_id.slice(0, 128) : null }).select().single()
  if (error || !report) { console.error('feedback create failed', error); return c.json({ error: 'We could not send your report. Please try again.', code: 'FEEDBACK_CREATE_FAILED' }, 500) }
  let screenshotKey: string | null = null
  if (screenshot) {
    try {
      const storageScope = user.school_id || `support-${user.id}`
      screenshotKey = buildPrivateFileKey(storageScope, 'feedback_screenshot', report.id, screenshot.extension)
      await uploadPrivateObject({ fileKey: screenshotKey, schoolId: storageScope, body: screenshot.buffer, contentType: screenshot.contentType })
      const { error: attachError } = await (supabase as any).from('feedback_reports').update({ screenshot_key: screenshotKey }).eq('id', report.id)
      if (attachError) throw attachError
    } catch (screenshotError) {
      Sentry.captureException(screenshotError, { tags: { feedback_id: report.id, operation: 'feedback_screenshot' } })
      // Remove the incomplete report so the retry without the screenshot is not a duplicate.
      const { error: cleanupError } = await (supabase as any).from('feedback_reports').delete().eq('id', report.id)
      if (cleanupError) console.error('feedback screenshot cleanup failed', cleanupError)
      recent.delete(user.id)
      return c.json({ error: 'We could not attach that screenshot. Please send the report again without it.', code: 'SCREENSHOT_FAILED' }, 502)
    }
  }
  Sentry.captureMessage('user_feedback_submitted', { level: 'info', tags: { feedback_id: report.id, kind, severity: severity || 'none', school_id: user.school_id || 'none' } })
  const origin = new URL(c.req.url).origin
  // Receipt and support alert are independent so one failure cannot suppress the other.
  if (user.email) {
    try {
      await sendReceipt(report, user)
      const { error: receiptError } = await (supabase as any).from('feedback_reports').update({ receipt_sent_at: new Date().toISOString() }).eq('id', report.id)
      if (receiptError) throw receiptError
    } catch (emailError) { Sentry.captureException(emailError, { tags: { feedback_id: report.id, operation: 'feedback_receipt' } }) }
  }
  try {
    const screenshotUrl = screenshotKey
      ? await createPresignedDownload(screenshotKey, user.school_id || `support-${user.id}`, 60 * 60 * 24 * 7)
      : null
    const screenshotHtml = screenshotUrl ? `<p><strong>Screenshot:</strong> <a href="${escapeHtml(screenshotUrl)}">View full image</a></p><p><a href="${escapeHtml(screenshotUrl)}"><img src="${escapeHtml(screenshotUrl)}" alt="Reporter screenshot" style="max-width:100%;height:auto;border:1px solid #ddd" /></a></p>` : ''
    const screenshotText = screenshotUrl ? `\n\nScreenshot: ${screenshotUrl}` : ''
    const resolveLink = resolveUrl(origin, report.id)
    await sendEmail({ from: getEmailConfig().from, to: [supportEmail()], replyTo: user.email || undefined, subject: `[${kind === 'bug' ? 'BUG' : 'IDEA'}] ${severity || 'new'} - ${(user.first_name || 'User').replace(/[\r\n]/g, ' ')}`, html: `<p><strong>Reference:</strong> KAN-${report.id.slice(0, 8).toUpperCase()}</p><p>${escapeHtml(description)}</p>${screenshotHtml}<p><a href="${escapeHtml(resolveLink)}">Mark report resolved</a></p>`, text: `Reference: KAN-${report.id.slice(0, 8).toUpperCase()}\n\n${description}${screenshotText}\n\nResolve: ${resolveLink}` }, { event: 'feedback_support', idempotencyKey: `feedback-support:${report.id}` })
  } catch (emailError) { Sentry.captureException(emailError, { tags: { feedback_id: report.id, operation: 'feedback_support_email' } }) }
  return c.json({ data: { id: report.id, reference: `KAN-${report.id.slice(0, 8).toUpperCase()}` } }, 201)
})

export const feedbackResolutionRouter = new Hono()
feedbackResolutionRouter.get('/:id/resolve', c => {
  const id = c.req.param('id')!, token = c.req.query('token') || ''
  if (!isValidResolveToken(id, token)) return c.text('Invalid or expired resolution link.', 403)
  return c.html(`<main style="font-family:system-ui;max-width:36rem;margin:5rem auto;padding:1.5rem"><h1>Resolve report</h1><p>Mark this report as resolved and notify the reporter?</p><form method="post" action="?token=${encodeURIComponent(token)}"><button type="submit">Mark resolved and notify</button></form></main>`)
})
feedbackResolutionRouter.post('/:id/resolve', async c => {
  const id = c.req.param('id')!, token = c.req.query('token') || ''
  if (!isValidResolveToken(id, token)) return c.text('Invalid or expired resolution link.', 403)
  const unavailable = (operation: string, error: unknown) => { console.error(`feedback resolve ${operation} failed`, error); return c.text('The report could not be updated right now. Please open the link again to retry.', 503) }

  const { data: found, error: findError } = await (supabase as any).from('feedback_reports').select('id, status, reporter_id, resolution_sent_at').eq('id', id).maybeSingle()
  if (findError) return unavailable('lookup', findError)
  if (!found) return c.text('This report is unavailable.', 404)
  if (found.status === 'open') {
    const { error: updateError } = await (supabase as any).from('feedback_reports').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id).eq('status', 'open')
    if (updateError) return unavailable('status update', updateError)
  }
  if (found.resolution_sent_at) return c.text('This report has already been resolved and the reporter notified.', 200)

  // The report is resolved but the reporter is only marked notified after delivery, so a failed send is retried by reopening the link.
  const { data: user, error: userError } = await (supabase as any).from('user_profiles').select('email, first_name').eq('id', found.reporter_id).maybeSingle()
  if (userError) return unavailable('reporter lookup', userError)
  if (user?.email) {
    try {
      await sendEmail({ from: getEmailConfig().from, to: [user.email], replyTo: supportEmail(), subject: `Your Kanvise report has been resolved (KAN-${id.slice(0, 8).toUpperCase()})`, html: `<p>Hello ${escapeHtml(user.first_name || 'there')},</p><p>We have resolved the issue you reported. If it persists, reply to this email and we will take another look.</p>`, text: 'We have resolved the issue you reported. If it persists, reply to this email and we will take another look.' }, { event: 'feedback_resolved', idempotencyKey: `feedback-resolved:${id}` })
    } catch (emailError) { return unavailable('notification', emailError) }
  }
  const { error: sentError } = await (supabase as any).from('feedback_reports').update({ resolution_sent_at: new Date().toISOString() }).eq('id', id)
  if (sentError) return unavailable('notification record', sentError)
  return c.text(user?.email ? 'Report resolved and the reporter has been notified.' : 'Report resolved. The reporter has no email address on file.')
})
