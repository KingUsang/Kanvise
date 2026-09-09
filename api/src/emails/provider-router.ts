import { createHash } from 'node:crypto'
import { Resend } from 'resend'
import { getEmailConfig, type EmailProviderName } from './config'
import type { EmailPayload } from './transport'

type SendOptions = {
  event: string
  idempotencyKey?: string
}

type ProviderResult = {
  id: string | null
  provider: EmailProviderName
}

type ProviderErrorDetails = {
  code?: string
  message: string
  retryAfterMs?: number
  status?: number
}

export type ProviderSender = (
  payload: EmailPayload,
  options: SendOptions,
) => Promise<{ id: string | null }>

const providerCooldowns = new Map<EmailProviderName, number>()
const DEFAULT_FAILURE_COOLDOWN_MS = 60_000
const DEFAULT_QUOTA_COOLDOWN_MS = 15 * 60_000

function asProviderError(error: unknown): ProviderErrorDetails {
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    return {
      code: typeof value.code === 'string' ? value.code : undefined,
      message: typeof value.message === 'string' ? value.message : 'Unknown provider error',
      retryAfterMs: typeof value.retryAfterMs === 'number' ? value.retryAfterMs : undefined,
      status: typeof value.status === 'number'
        ? value.status
        : typeof value.statusCode === 'number' ? value.statusCode : undefined,
    }
  }
  return { message: error instanceof Error ? error.message : String(error) }
}

function isQuotaFailure(error: ProviderErrorDetails) {
  return error.status === 429
    || /quota|rate.?limit|daily.?limit|too many requests/i.test(`${error.code || ''} ${error.message}`)
}

function parseMailbox(value: string) {
  const match = value.trim().match(/^(.*?)\s*<([^<>]+)>$/)
  if (!match) return { email: value.trim() }
  const name = match[1].trim().replace(/^['"]|['"]$/g, '')
  return { email: match[2].trim(), ...(name ? { name } : {}) }
}

function stableUuid(value: string) {
  const bytes = Buffer.from(createHash('sha256').update(value).digest().subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function createResendSender(apiKey: string): ProviderSender {
  const client = new Resend(apiKey).emails
  return async (payload, options) => {
    const { data, error } = await client.send(payload, options.idempotencyKey
      ? { idempotencyKey: options.idempotencyKey }
      : undefined)
    if (error) throw error
    return { id: data?.id || null }
  }
}

export function createBrevoSender(
  apiKey: string,
  fetchImplementation: typeof fetch = fetch,
  timeoutMs = 3_500,
): ProviderSender {
  return async (payload, options) => {
    const response = await fetchImplementation('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: parseMailbox(payload.from),
        to: payload.to.map((email) => ({ email })),
        subject: payload.subject,
        htmlContent: payload.html,
        textContent: payload.text,
        ...(payload.replyTo ? { replyTo: parseMailbox(payload.replyTo) } : {}),
        ...(options.idempotencyKey ? {
          headers: { idempotencyKey: stableUuid(options.idempotencyKey) },
        } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    const body = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) {
      const retryAfterSeconds = Number(response.headers.get('retry-after'))
      throw {
        code: typeof body.code === 'string' ? body.code : undefined,
        message: typeof body.message === 'string' ? body.message : `Brevo returned HTTP ${response.status}`,
        retryAfterMs: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1_000 : undefined,
        status: response.status,
      } satisfies ProviderErrorDetails
    }
    return { id: typeof body.messageId === 'string' ? body.messageId : null }
  }
}

export async function sendUsingProviderChain(input: {
  event: string
  idempotencyKey?: string
  now?: () => number
  order: EmailProviderName[]
  payload: EmailPayload
  senders: Partial<Record<EmailProviderName, ProviderSender>>
}): Promise<ProviderResult> {
  const now = input.now || Date.now
  const failures: string[] = []

  for (const provider of input.order) {
    const sender = input.senders[provider]
    if (!sender) continue

    const cooldownUntil = providerCooldowns.get(provider) || 0
    if (cooldownUntil > now()) {
      failures.push(`${provider}: cooling down`)
      console.warn('email.provider_skipped', {
        provider,
        event: input.event,
        idempotencyKey: input.idempotencyKey,
        cooldownUntil: new Date(cooldownUntil).toISOString(),
      })
      continue
    }

    try {
      const result = await sender(input.payload, {
        event: input.event,
        idempotencyKey: input.idempotencyKey,
      })
      providerCooldowns.delete(provider)
      console.info('email.provider_sent', {
        provider,
        event: input.event,
        idempotencyKey: input.idempotencyKey,
        providerMessageId: result.id,
      })
      return { ...result, provider }
    } catch (error) {
      const details = asProviderError(error)
      const quotaFailure = isQuotaFailure(details)
      const cooldownMs = details.retryAfterMs
        || (quotaFailure ? DEFAULT_QUOTA_COOLDOWN_MS : DEFAULT_FAILURE_COOLDOWN_MS)
      const cooldownUntil = now() + cooldownMs
      providerCooldowns.set(provider, cooldownUntil)
      failures.push(`${provider}: ${details.message}`)
      console.warn('email.provider_failed', {
        provider,
        event: input.event,
        idempotencyKey: input.idempotencyKey,
        code: details.code,
        status: details.status,
        quotaFailure,
        cooldownUntil: new Date(cooldownUntil).toISOString(),
        error: details.message.slice(0, 300),
      })
    }
  }

  throw new Error(`All configured email providers failed (${failures.join('; ')})`)
}

export async function sendEmail(
  payload: EmailPayload,
  options: SendOptions,
): Promise<ProviderResult> {
  const config = getEmailConfig()
  const senders: Partial<Record<EmailProviderName, ProviderSender>> = {}
  if (config.resendApiKey) senders.resend = createResendSender(config.resendApiKey)
  if (config.brevoApiKey) senders.brevo = createBrevoSender(
    config.brevoApiKey,
    fetch,
    config.providerTimeoutMs,
  )
  return sendUsingProviderChain({
    event: options.event,
    idempotencyKey: options.idempotencyKey,
    order: config.providerOrder,
    payload,
    senders,
  })
}

export function resetEmailProviderStateForTests() {
  providerCooldowns.clear()
}
