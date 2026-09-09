import { Webhook } from 'standardwebhooks'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseSendEmailHookPayload } from '../emails/supabase-auth'
import { handleSupabaseEmailHook } from './supabase-email-hook'

const secretBody = Buffer.alloc(32, 7).toString('base64')
const storedSecret = `v1,whsec_${secretBody}`
const verifierSecret = `whsec_${secretBody}`
const payload: SupabaseSendEmailHookPayload = {
  user: { id: 'user-1', email: 'student@example.com' },
  email_data: { email_action_type: 'signup', token: '123456', token_hash: 'hash' },
}

function signedRequest(body = JSON.stringify(payload)) {
  const id = 'msg_test_1'
  const timestamp = new Date()
  const signature = new Webhook(verifierSecret).sign(id, timestamp, body)
  return new Request('https://api.kanvise.com/webhooks/supabase/send-email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': signature,
    },
    body,
  })
}

describe('Supabase Send Email HTTP Hook', () => {
  it('verifies the exact raw body before delivering', async () => {
    const deliver = vi.fn().mockResolvedValue([])
    const response = await handleSupabaseEmailHook(signedRequest(), {
      env: { SEND_EMAIL_HOOK_SECRET: storedSecret } as NodeJS.ProcessEnv,
      deliver,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({})
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ payload, webhookId: 'msg_test_1' }))
  })

  it('rejects an invalid signature without attempting delivery', async () => {
    const deliver = vi.fn()
    const request = signedRequest()
    request.headers.set('webhook-signature', 'v1,invalid')
    const response = await handleSupabaseEmailHook(request, {
      env: { SEND_EMAIL_HOOK_SECRET: storedSecret } as NodeJS.ProcessEnv,
      deliver,
    })
    expect(response.status).toBe(401)
    expect(deliver).not.toHaveBeenCalled()
  })

  it('returns Supabase’s runtime-error shape when every provider fails', async () => {
    const response = await handleSupabaseEmailHook(signedRequest(), {
      env: { SEND_EMAIL_HOOK_SECRET: storedSecret } as NodeJS.ProcessEnv,
      deliver: vi.fn().mockRejectedValue(new Error('All providers failed')),
    })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: { http_code: 503, message: 'Email delivery temporarily failed' },
    })
  })
})
