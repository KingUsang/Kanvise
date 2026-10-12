import { createHmac, timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import * as Sentry from '@sentry/node'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware } from '../middleware/auth'
import { getEmailConfig } from '../emails/config'
import { sendEmail } from '../emails/provider-router'
import type { AppVariables } from '../types'
import { buildPrivateFileKey, createPresignedDownload, uploadPrivateObject, validatePrivateUploadMetadata } from '../storage/r2'

export const feedbackRouter = new Hono<{ Variables: AppVariables }>()
const recent = new Map<string, number>()

function supportEmail() { return process.env.SUPPORT_EMAIL?.trim() || 'hello@kanvise.com' }
function resolveToken(id: string) { return createHmac('sha256', process.env.KANVISE_INTERNAL_SECRET || '').update(`feedback:${id}`).digest('hex') }
function safeEqual(a: string, b: string) { return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)) }
function resolveUrl(origin: string, id: string) { return `${origin.replace(/\/$/, '')}/support/feedback/${id}/resolve?token=${resolveToken(id)}` }

async function sendReceipt(report: any, user: any) {
  const config = getEmailConfig()
  const ref = `KAN-${report.id.slice(0, 8).toUpperCase()}`
  const isBug = report.kind === 'bug'
  const message = isBug ? 'We’ve received your report and will get back to you shortly.' : 'We’ve received your suggestion and will get back to you shortly.'
  await sendEmail({ from: config.from, to: [user.email], replyTo: supportEmail(), subject: `${isBug ? 'We received your report' : 'We received your suggestion'} (${ref})`, html: `<p>Hello ${user.first_name || 'there'},</p><p>${message}</p><p>Reference: <strong>${ref}</strong></p>`, text: `${message} Reference: ${ref}` }, { event: 'feedback_receipt', idempotencyKey: `feedback-receipt:${report.id}` })
}

feedbackRouter.use('/*', jwtVerificationMiddleware, profileResolutionMiddleware)
feedbackRouter.post('/', async c => {
  const user = c.get('user') as any
  const body = await c.req.json().catch(() => null) as any
  const kind = body?.kind === 'bug' || body?.kind === 'feature' ? body.kind : null
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  const attemptedAction = typeof body?.attempted_action === 'string' ? body.attempted_action.trim() : null
  const severity = kind === 'bug' && ['blocking', 'major', 'minor'].includes(body?.severity) ? body.severity : null
  if (!kind || !description || description.length > 4000 || (kind === 'bug' && !severity)) return c.json({ error: 'Please complete the report details.', code: 'VALIDATION_ERROR' }, 400)
  const now = Date.now(); if ((recent.get(user.id) || 0) > now - 60_000) return c.json({ error: 'Please wait a moment before sending another report.', code: 'RATE_LIMITED' }, 429); recent.set(user.id, now)
  const { data: report, error } = await (supabase as any).from('feedback_reports').insert({ reporter_id: user.id, school_id: user.school_id || null, kind, severity, description, attempted_action: attemptedAction || null, page_url: typeof body.page_url === 'string' ? body.page_url.slice(0, 2000) : null, user_agent: c.req.header('user-agent')?.slice(0, 512) || null, sentry_event_id: typeof body.sentry_event_id === 'string' ? body.sentry_event_id.slice(0, 128) : null }).select().single()
  if (error || !report) { console.error('feedback create failed', error); return c.json({ error: 'We could not send your report. Please try again.', code: 'FEEDBACK_CREATE_FAILED' }, 500) }
  let screenshotKey: string | null = null
  if (body?.screenshot) {
    try {
      const shot = body.screenshot
      if (typeof shot.name !== 'string' || typeof shot.content_type !== 'string' || typeof shot.data !== 'string') throw new Error('invalid screenshot')
      const buffer = Buffer.from(shot.data, 'base64')
      const metadata = validatePrivateUploadMetadata({ entityType: 'feedback_screenshot', fileName: shot.name, contentType: shot.content_type, fileSizeBytes: buffer.length })
      const storageScope = user.school_id || `support-${user.id}`
      screenshotKey = buildPrivateFileKey(storageScope, 'feedback_screenshot', report.id, metadata.extension)
      await uploadPrivateObject({ fileKey: screenshotKey, schoolId: storageScope, body: buffer, contentType: shot.content_type })
      await (supabase as any).from('feedback_reports').update({ screenshot_key: screenshotKey }).eq('id', report.id)
    } catch { return c.json({ error: 'We could not attach that screenshot. Please send the report again without it.', code: 'SCREENSHOT_FAILED' }, 400) }
  }
  Sentry.captureMessage('user_feedback_submitted', { level: 'info', tags: { feedback_id: report.id, kind, severity: severity || 'none', school_id: user.school_id || 'none' } })
  const origin = new URL(c.req.url).origin
  try {
    if (user.email) await sendReceipt(report, user)
    const screenshotUrl = screenshotKey
      ? await createPresignedDownload(screenshotKey, user.school_id || `support-${user.id}`, 60 * 60 * 24 * 7)
      : null
    const screenshotHtml = screenshotUrl ? `<p><strong>Screenshot:</strong> <a href="${screenshotUrl}">View full image</a></p><p><a href="${screenshotUrl}"><img src="${screenshotUrl}" alt="Reporter screenshot" style="max-width:100%;height:auto;border:1px solid #ddd" /></a></p>` : ''
    const screenshotText = screenshotUrl ? `\n\nScreenshot: ${screenshotUrl}` : ''
    await sendEmail({ from: getEmailConfig().from, to: [supportEmail()], replyTo: user.email || undefined, subject: `[${kind === 'bug' ? 'BUG' : 'IDEA'}] ${severity || 'new'} — ${user.first_name || 'User'}`, html: `<p><strong>Reference:</strong> KAN-${report.id.slice(0, 8).toUpperCase()}</p><p>${description.replace(/</g, '&lt;')}</p>${screenshotHtml}<p><a href="${resolveUrl(origin, report.id)}">Mark report resolved</a></p>`, text: `Reference: KAN-${report.id.slice(0, 8).toUpperCase()}\n\n${description}${screenshotText}\n\nResolve: ${resolveUrl(origin, report.id)}` }, { event: 'feedback_support', idempotencyKey: `feedback-support:${report.id}` })
    await (supabase as any).from('feedback_reports').update({ receipt_sent_at: new Date().toISOString() }).eq('id', report.id)
  } catch (emailError) { Sentry.captureException(emailError, { tags: { feedback_id: report.id, operation: 'feedback_email' } }) }
  return c.json({ data: { id: report.id, reference: `KAN-${report.id.slice(0, 8).toUpperCase()}` } }, 201)
})

export const feedbackResolutionRouter = new Hono()
feedbackResolutionRouter.get('/:id/resolve', c => {
  const id = c.req.param('id')!, token = c.req.query('token') || ''
  if (!process.env.KANVISE_INTERNAL_SECRET || !safeEqual(token, resolveToken(id))) return c.text('Invalid resolution link.', 403)
  return c.html(`<main style="font-family:system-ui;max-width:36rem;margin:5rem auto;padding:1.5rem"><h1>Resolve report</h1><p>Mark this report as resolved and notify the reporter?</p><form method="post" action="?token=${encodeURIComponent(token)}"><button type="submit">Mark resolved and notify</button></form></main>`)
})
feedbackResolutionRouter.post('/:id/resolve', async c => {
  const id = c.req.param('id')!, token = c.req.query('token') || ''
  if (!process.env.KANVISE_INTERNAL_SECRET || !safeEqual(token, resolveToken(id))) return c.text('Invalid resolution link.', 403)
  const { data: report } = await (supabase as any).from('feedback_reports').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id).eq('status', 'open').select().single()
  if (!report) return c.text('This report has already been resolved or is unavailable.', 200)
  const { data: user } = await (supabase as any).from('user_profiles').select('email, first_name').eq('id', report.reporter_id).single()
  if (user?.email) await sendEmail({ from: getEmailConfig().from, to: [user.email], replyTo: supportEmail(), subject: `Your Kanvise report has been resolved (KAN-${id.slice(0, 8).toUpperCase()})`, html: `<p>Hello ${user.first_name || 'there'},</p><p>We have resolved the issue you reported. If it persists, reply to this email and we will take another look.</p>`, text: 'We have resolved the issue you reported. If it persists, reply to this email and we will take another look.' }, { event: 'feedback_resolved', idempotencyKey: `feedback-resolved:${id}` })
  await (supabase as any).from('feedback_reports').update({ resolution_sent_at: new Date().toISOString() }).eq('id', id)
  return c.text('Report resolved and the reporter has been notified.')
})
