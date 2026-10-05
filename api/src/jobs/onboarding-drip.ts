import { supabase } from '../lib/supabase'
import { sendEmail } from '../emails/provider-router'
import { getEmailConfig } from '../emails/config'
import { renderEmail } from '../emails/render-email'

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
  const ONE_HOUR = 60 * 60 * 1000
  const ONE_DAY = 24 * ONE_HOUR

  for (const user of users) {
    const ageMs = now - new Date(user.created_at).getTime()
    
    const sends = [
      { key: 'founder_letter', trigger: ONE_HOUR },
      { key: 'meet_kavi', trigger: 2 * ONE_DAY },
      { key: 'use_this_thing', trigger: 3 * ONE_DAY },
      { key: 'first_week', trigger: 7 * ONE_DAY },
      { key: 'kavi_challenge', trigger: 14 * ONE_DAY },
    ]

    for (const send of sends) {
      if (ageMs > send.trigger) {
        const idempotencyKey = `drip_${send.key}_${user.id}`
        const { data: existing } = await supabase
          .from('email_deliveries')
          .select('idempotency_key')
          .eq('idempotency_key', idempotencyKey)
          .single()
        
        if (!existing) {
          // Send email
          try {
            if (!user.email) continue;
            const frontendUrl = (process.env.FRONTEND_URL || 'https://kanvise.com').replace(/\/$/, '')
            
            await supabase.from('email_deliveries').upsert({
              idempotency_key: idempotencyKey,
              event_type: send.key,
              recipient_email: user.email,
              status: 'pending'
            })
            
            const rendered = await renderEmail(send.key as any, {
              firstName: user.first_name,
              actionUrl: frontendUrl + '/dashboard',
            }, config.logoUrl)
            
            const result = await sendEmail({
              from: config.from,
              to: [user.email],
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
              replyTo: config.replyTo,
            }, { event: send.key, idempotencyKey })
            
            await supabase.from('email_deliveries').update({
              status: 'sent',
              provider_message_id: result.id,
              sent_at: new Date().toISOString()
            }).eq('idempotency_key', idempotencyKey)
          } catch (err) {
             console.error(`Failed to send drip ${send.key} to ${user.email}`, err)
          }
        }
      }
    }
  }
}
