import { createHash } from 'node:crypto'
import { getEmailConfig, type EmailProviderName } from './config'
import type { EmailPayload } from './transport'
import { supabaseEmailProviderUsageStore, type EmailProviderUsageStore } from './provider-usage'

type SendOptions = {
  event: string
  idempotencyKey?: string
  providerTimeoutMs?: number
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

export function createResendSender(
  apiKey: string,
  fetchImplementation: typeof fetch = fetch,
  timeoutMs = 3_500,
): ProviderSender {
  return async (payload, options) => {
    const response = await fetchImplementation('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    const body = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) {
      const retryAfterSeconds = Number(response.headers.get('retry-after'))
      throw {
        code: typeof body.name === 'string' ? body.name : undefined,
        message: typeof body.message === 'string' ? body.message : `Resend returned HTTP ${response.status}`,
        retryAfterMs: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1_000 : undefined,
        status: response.status,
      } satisfies ProviderErrorDetails
    }
    return { id: typeof body.id === 'string' ? body.id : null }
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

export function createMailjetSender(
  apiKey: string,
  secretKey: string,
  fetchImplementation: typeof fetch = fetch,
  timeoutMs = 3_500,
): ProviderSender {
  return async (payload, options) => {
    const response = await fetchImplementation('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        Messages: [{
          From: capitalizeMailbox(parseMailbox(payload.from)),
          To: payload.to.map((email) => ({ Email: email })),
          Subject: payload.subject,
          HTMLPart: payload.html,
          TextPart: payload.text,
          ...(payload.replyTo ? { ReplyTo: capitalizeMailbox(parseMailbox(payload.replyTo)) } : {}),
          ...(options.idempotencyKey ? { CustomID: stableUuid(options.idempotencyKey) } : {}),
        }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    const body = await response.json().catch(() => ({})) as Record<string, unknown>
    const messages = Array.isArray(body.Messages) ? body.Messages as Array<Record<string, unknown>> : []
    const message = messages[0]
    const recipients = message && Array.isArray(message.To)
      ? message.To as Array<Record<string, unknown>>
      : []
    if (!response.ok || message?.Status !== 'success') {
      const errors = message && Array.isArray(message.Errors)
        ? message.Errors as Array<Record<string, unknown>>
        : []
      const firstError = errors[0]
      const retryAfterSeconds = Number(response.headers.get('retry-after'))
      throw {
        code: typeof firstError?.ErrorCode === 'string' ? firstError.ErrorCode : undefined,
        message: typeof firstError?.ErrorMessage === 'string'
          ? firstError.ErrorMessage
          : `Mailjet returned HTTP ${response.status}`,
        retryAfterMs: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1_000 : undefined,
        status: response.status,
      } satisfies ProviderErrorDetails
    }

    const messageUuid = recipients[0]?.MessageUUID
    const messageId = recipients[0]?.MessageID
    return {
      id: typeof messageUuid === 'string'
        ? messageUuid
        : typeof messageId === 'string' || typeof messageId === 'number' ? String(messageId) : null,
    }
  }
}

function capitalizeMailbox(mailbox: { email: string; name?: string }) {
  return {
    Email: mailbox.email,
    ...(mailbox.name ? { Name: mailbox.name } : {}),
  }
}

export async function sendUsingProviderChain(input: {
  event: string
  idempotencyKey?: string
  now?: () => number
  order: EmailProviderName[]
  payload: EmailPayload
  senders: Partial<Record<EmailProviderName, ProviderSender>>
  usageStore?: EmailProviderUsageStore
  dailyLimits?: Record<EmailProviderName, number>
  usageThresholdPercent?: number
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

    if (input.usageStore && input.dailyLimits && input.usageThresholdPercent) {
      try {
        const capacity = await input.usageStore.reserve({
          provider,
          dailyLimit: input.dailyLimits[provider],
          thresholdPercent: input.usageThresholdPercent,
          recipientCount: input.payload.to.length,
        })
        if (!capacity.allowed) {
          failures.push(`${provider}: ${capacity.reason}`)
          console.warn('email.provider_capacity_skipped', {
            provider,
            event: input.event,
            reason: capacity.reason,
            used: capacity.used,
            threshold: capacity.threshold,
          })
          continue
        }
      } catch (error) {
        console.error('email.provider_capacity_check_failed', {
          provider,
          event: input.event,
          error: asProviderError(error).message.slice(0, 300),
        })
      }
    }

    try {
      const result = await sender(input.payload, {
        event: input.event,
        idempotencyKey: input.idempotencyKey,
      })
      providerCooldowns.delete(provider)
      await input.usageStore?.record({
        provider,
        recipientCount: input.payload.to.length,
        succeeded: true,
        quotaFailure: false,
      }).catch((error) => console.error('email.provider_usage_record_failed', {
        provider,
        event: input.event,
        error: asProviderError(error).message.slice(0, 300),
      }))
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
      await input.usageStore?.record({
        provider,
        recipientCount: input.payload.to.length,
        succeeded: false,
        quotaFailure,
        cooldownUntil: new Date(cooldownUntil),
        error: details.message,
      }).catch((recordError) => console.error('email.provider_usage_record_failed', {
        provider,
        event: input.event,
        error: asProviderError(recordError).message.slice(0, 300),
      }))
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
  const providerTimeoutMs = options.providerTimeoutMs || config.providerTimeoutMs
  const senders: Partial<Record<EmailProviderName, ProviderSender>> = {}
  if (config.resendApiKey) senders.resend = createResendSender(config.resendApiKey, fetch, providerTimeoutMs)
  if (config.brevoApiKey) senders.brevo = createBrevoSender(
    config.brevoApiKey,
    fetch,
    providerTimeoutMs,
  )
  if (config.mailjetApiKey && config.mailjetSecretKey) {
    senders.mailjet = createMailjetSender(
      config.mailjetApiKey,
      config.mailjetSecretKey,
      fetch,
      providerTimeoutMs,
    )
  }
  return sendUsingProviderChain({
    event: options.event,
    idempotencyKey: options.idempotencyKey,
    order: config.providerOrder,
    payload,
    senders,
    usageStore: supabaseEmailProviderUsageStore,
    dailyLimits: config.providerDailyLimits,
    usageThresholdPercent: config.providerUsageThresholdPercent,
  })
}

export function resetEmailProviderStateForTests() {
  providerCooldowns.clear()
}
