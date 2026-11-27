import { Webhook } from 'standardwebhooks'
import { deliverSupabaseAuthEmail, type SupabaseSendEmailHookPayload } from '../emails/supabase-auth'

type Dependencies = {
  deliver?: typeof deliverSupabaseAuthEmail
  env?: NodeJS.ProcessEnv
}

function webhookSecrets(value: string | undefined) {
  if (!value?.trim()) throw new Error('SEND_EMAIL_HOOK_SECRET is not configured')
  return value.split('|').map((entry) => entry.trim()).filter(Boolean).map((entry) => (
    entry.startsWith('v1,') ? entry.slice(3) : entry
  ))
}

function verifyPayload(rawBody: string, headers: Record<string, string>, secretValue: string | undefined) {
  let lastError: unknown
  for (const secret of webhookSecrets(secretValue)) {
    try {
      return new Webhook(secret).verify(rawBody, headers) as SupabaseSendEmailHookPayload
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('Webhook signature verification failed')
}

// Auth hook payloads are small JSON documents. Bound the read before the
// signature is checked so an unauthenticated caller cannot force large buffers.
export const MAX_EMAIL_HOOK_BODY_BYTES = 64 * 1024

async function readBoundedBody(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export async function handleSupabaseEmailHook(request: Request, dependencies: Dependencies = {}) {
  const env = dependencies.env || process.env
  const deliver = dependencies.deliver || deliverSupabaseAuthEmail
  const rawBody = await readBoundedBody(request, MAX_EMAIL_HOOK_BODY_BYTES)
  if (rawBody === null) {
    console.warn('supabase.email_hook_rejected', { reason: 'body_too_large' })
    return Response.json({
      error: { http_code: 413, message: 'Request body too large' },
    }, { status: 413 })
  }
  const headers = Object.fromEntries(request.headers.entries())
  let payload: SupabaseSendEmailHookPayload

  try {
    payload = verifyPayload(rawBody, headers, env.SEND_EMAIL_HOOK_SECRET)
  } catch (error) {
    const configurationError = error instanceof Error && error.message.includes('not configured')
    console.warn('supabase.email_hook_rejected', {
      reason: configurationError ? 'hook_secret_missing' : 'signature_invalid',
    })
    return Response.json({
      error: {
        http_code: configurationError ? 503 : 401,
        message: configurationError ? 'Email delivery is not configured' : 'Invalid webhook signature',
      },
    }, { status: configurationError ? 503 : 401 })
  }

  const webhookId = request.headers.get('webhook-id') || 'missing-id'
  try {
    await deliver({ env, payload, webhookId })
    return Response.json({}, { status: 200 })
  } catch (error) {
    console.error('supabase.email_hook_failed', {
      action: payload.email_data?.email_action_type,
      userId: payload.user?.id,
      webhookId,
      error: error instanceof Error ? error.message.slice(0, 300) : 'Unknown email delivery error',
    })
    return Response.json({
      error: { http_code: 503, message: 'Email delivery temporarily failed' },
    }, { status: 503 })
  }
}
