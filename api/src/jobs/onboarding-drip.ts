import { supabase } from '../lib/supabase'
import { sendEmail } from '../emails/provider-router'
import { getEmailConfig } from '../emails/config'
import { renderEmail } from '../emails/render-email'
import { holdSentClaim, retryWrite } from '../lib/retry-write'

const ONE_HOUR = 60 * 60 * 1000
const ONE_DAY = 24 * ONE_HOUR

const DRIP_STEPS = [
  { key: 'founder_letter', trigger: ONE_HOUR },
  { key: 'meet_kavi', trigger: 2 * ONE_DAY },
  { key: 'use_this_thing', trigger: 3 * ONE_DAY },
  { key: 'first_week', trigger: 7 * ONE_DAY },
  { key: 'kavi_challenge', trigger: 14 * ONE_DAY },
] as const

// A step is abandoned after this many failed attempts so one bad address does
// not retry hourly forever. Later steps for that user still proceed.
const MAX_STEP_ATTEMPTS = 5

// Only accounts young enough to still owe a step are scanned, in a bounded batch
// ordered oldest first (DEV-JOB-002).
const LAST_TRIGGER_MS = Math.max(...DRIP_STEPS.map((step) => step.trigger))
const SCAN_WINDOW_MS = LAST_TRIGGER_MS + ONE_DAY
const SCAN_BATCH_SIZE = 500

export async function runOnboardingDripJob() {
  const config = getEmailConfig()
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('id, first_name, email, created_at, role')
    .in('role', ['admin', 'tutor'])
    .gte('created_at', new Date(Date.now() - SCAN_WINDOW_MS).toISOString())
    .order('created_at', { ascending: true })
    .limit(SCAN_BATCH_SIZE)

  if (error || !users) {
    console.error('Failed to fetch users for drip job', error)
    return
  }

  const now = Date.now()

  for (const user of users) {
    if (!user.email) continue
    const ageMs = now - new Date(user.created_at).getTime()

    for (const step of DRIP_STEPS) {
      if (ageMs <= step.trigger) continue

      const idempotencyKey = `drip_${step.key}_${user.id}`
      const { data: existing, error: existingError } = await supabase
        .from('email_deliveries')
        .select('status, attempt_count')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()

      if (existingError) {
        console.error(`Failed to inspect drip ${step.key} state for ${user.email}`, existingError)
        break
      }

      if (existing?.status === 'sent') continue
      // A step that used every attempt is skipped, not left blocking the rest.
      if (existing && existing.attempt_count >= MAX_STEP_ATTEMPTS) continue

      let providerAccepted = false
      try {
        const frontendUrl = (process.env.FRONTEND_URL || 'https://kanvise.com').replace(/\/$/, '')

        const { error: createError } = await supabase.from('email_deliveries').upsert({
          idempotency_key: idempotencyKey,
          event_type: step.key,
          recipient_email: user.email,
        }, { onConflict: 'idempotency_key', ignoreDuplicates: true })
        if (createError) throw createError

        // Atomic claim: a crashed or concurrent run cannot send this step twice,
        // and an expired claim or failed row becomes claimable again.
        const { data: claimed, error: claimError } = await (supabase as any).rpc('claim_email_delivery', { p_key: idempotencyKey, p_lease_seconds: 600 })
        if (claimError) throw claimError
        if (!claimed) break

        const rendered = await renderEmail(step.key as any, {
          firstName: user.first_name,
          actionUrl: `${frontendUrl}/dashboard`,
        }, config.logoUrl)

        const result = await sendEmail({
          from: config.from,
          to: [user.email],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          replyTo: config.replyTo,
        }, { event: step.key, idempotencyKey })
        providerAccepted = true

        const recorded = await retryWrite(async () => {
          const { error: sentError } = await supabase.from('email_deliveries').update({
            status: 'sent',
            provider_message_id: result.id,
            sent_at: new Date().toISOString(),
            last_error: null,
            claimed_until: null,
            updated_at: new Date().toISOString(),
          }).eq('idempotency_key', idempotencyKey)
          if (sentError) throw sentError
        })
        if (!recorded) {
          console.error(`Drip ${step.key} sent to ${user.email} but its sent state could not be saved`)
          await holdSentClaim('email_deliveries', idempotencyKey)
        }
      } catch (err) {
        console.error(`Failed to send drip ${step.key} to ${user.email}`, err)
        if (!providerAccepted) {
          const message = err instanceof Error ? err.message : 'Unknown drip delivery error'
          const { error: failedError } = await supabase.from('email_deliveries').update({
            status: 'failed', last_error: message.slice(0, 500), claimed_until: null, updated_at: new Date().toISOString(),
          }).eq('idempotency_key', idempotencyKey)
          if (failedError) console.error(`Failed to record drip ${step.key} failure`, failedError)
        }
      }

      break
    }
  }
}
