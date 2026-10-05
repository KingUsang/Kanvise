import { supabase } from '../lib/supabase'
import { sendEmail } from '../emails/provider-router'
import { getEmailConfig } from '../emails/config'
import { renderEmail } from '../emails/render-email'

const ONE_HOUR = 60 * 60 * 1000
const ONE_DAY = 24 * ONE_HOUR

const DRIP_STEPS = [
  { key: 'founder_letter', trigger: ONE_HOUR },
  { key: 'meet_kavi', trigger: 2 * ONE_DAY },
  { key: 'use_this_thing', trigger: 3 * ONE_DAY },
  { key: 'first_week', trigger: 7 * ONE_DAY },
  { key: 'kavi_challenge', trigger: 14 * ONE_DAY },
] as const

export async function runOnboardingDripJob() {
  const config = getEmailConfig()
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('id, first_name, email, created_at, role')
    .in('role', ['admin', 'tutor'])
  
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
        .select('status')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()

      if (existingError) {
        console.error(`Failed to inspect drip ${step.key} state for ${user.email}`, existingError)
        break
      }

      if (existing?.status === 'sent') continue
      if (existing) break

      try {
        const frontendUrl = (process.env.FRONTEND_URL || 'https://kanvise.com').replace(/\/$/, '')

        await supabase.from('email_deliveries').upsert({
          idempotency_key: idempotencyKey,
          event_type: step.key,
          recipient_email: user.email,
          status: 'pending',
        })

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

        await supabase.from('email_deliveries').update({
          status: 'sent',
          provider_message_id: result.id,
          sent_at: new Date().toISOString(),
        }).eq('idempotency_key', idempotencyKey)
      } catch (err) {
        console.error(`Failed to send drip ${step.key} to ${user.email}`, err)
      }

      break
    }
  }
}
