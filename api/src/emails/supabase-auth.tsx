import { render } from '@react-email/render'
import { getEmailConfig } from './config'
import { sendEmail } from './provider-router'
import { AuthActionEmail } from './templates/auth-action'
import type { EmailPayload } from './transport'

export type SupabaseEmailAction = 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change' | 'reauthentication'

export type SupabaseSendEmailHookPayload = {
  user: {
    id: string
    email?: string
    new_email?: string
  }
  email_data: {
    email_action_type: SupabaseEmailAction | string
    redirect_to?: string
    site_url?: string
    token?: string
    token_hash?: string
    token_new?: string
    token_hash_new?: string
  }
}

type AuthMessage = {
  actionLabel?: string
  actionUrl?: string
  body: string
  code?: string
  recipient: string
  subject: string
  heading: string
  suffix: string
}

type AuthEmailSender = (
  payload: EmailPayload,
  options: { event: string; idempotencyKey?: string; providerTimeoutMs?: number },
) => Promise<{ id: string | null; provider: string }>

const actionContent: Record<string, { subject: string; heading: string; body: string; actionLabel?: string }> = {
  signup: {
    subject: 'Confirm your Kanvise email',
    heading: 'Confirm your email address.',
    body: 'Enter this code on Kanvise to finish creating your account.',
  },
  recovery: {
    subject: 'Reset your Kanvise password',
    heading: 'Reset your password.',
    body: 'Enter this code on Kanvise to continue resetting your password.',
  },
  invite: {
    subject: 'You’re invited to Kanvise',
    heading: 'Your Kanvise invitation is ready.',
    body: 'Use the secure button below to accept your invitation and set up your account.',
    actionLabel: 'Accept invitation',
  },
  magiclink: {
    subject: 'Your Kanvise sign-in link',
    heading: 'Sign in to Kanvise.',
    body: 'Use the secure button below to sign in. This link can only be used once.',
    actionLabel: 'Sign in to Kanvise',
  },
  email_change: {
    subject: 'Confirm your Kanvise email change',
    heading: 'Confirm your email change.',
    body: 'Use this code or the secure button below to confirm the change to your email address.',
    actionLabel: 'Confirm email change',
  },
  reauthentication: {
    subject: 'Confirm it’s you',
    heading: 'Confirm it’s you.',
    body: 'Enter this code on Kanvise to continue with this security-sensitive action.',
  },
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
  return value.trim()
}

function verificationUrl(input: {
  action: string
  redirectTo?: string
  supabaseUrl: string
  tokenHash?: string
}) {
  if (!input.tokenHash || !['invite', 'magiclink', 'email_change'].includes(input.action)) return undefined
  const url = new URL('/auth/v1/verify', input.supabaseUrl)
  url.searchParams.set('token', input.tokenHash)
  url.searchParams.set('type', input.action)
  if (input.redirectTo) url.searchParams.set('redirect_to', input.redirectTo)
  return url.toString()
}

export function buildSupabaseAuthMessages(
  payload: SupabaseSendEmailHookPayload,
  supabaseUrl: string,
): AuthMessage[] {
  const action = requiredText(payload.email_data?.email_action_type, 'email_data.email_action_type')
  const content = actionContent[action] || {
    subject: 'Your Kanvise verification code',
    heading: 'Verify your request.',
    body: 'Enter this code on Kanvise to continue.',
  }
  const common = (recipient: string, code: string | undefined, tokenHash: string | undefined, suffix: string) => ({
    ...content,
    recipient: requiredText(recipient, 'recipient email'),
    code: code?.trim() || undefined,
    actionUrl: verificationUrl({
      action,
      redirectTo: payload.email_data.redirect_to || payload.email_data.site_url,
      supabaseUrl,
      tokenHash: tokenHash?.trim(),
    }),
    suffix,
  })

  if (action !== 'email_change') {
    return [common(requiredText(payload.user?.email, 'user.email'), payload.email_data.token, payload.email_data.token_hash, action)]
  }

  const messages: AuthMessage[] = []
  const currentEmail = payload.user?.email?.trim()
  const newEmail = payload.user?.new_email?.trim()
  if (currentEmail && payload.email_data.token && payload.email_data.token_hash_new) {
    messages.push(common(currentEmail, payload.email_data.token, payload.email_data.token_hash_new, 'email_change_current'))
  }
  if (newEmail && payload.email_data.token_hash) {
    messages.push(common(
      newEmail,
      payload.email_data.token_new || payload.email_data.token,
      payload.email_data.token_hash,
      'email_change_new',
    ))
  }
  if (!messages.length) throw new Error('Email change payload has no deliverable recipient')
  return messages
}

export async function deliverSupabaseAuthEmail(input: {
  env?: NodeJS.ProcessEnv
  payload: SupabaseSendEmailHookPayload
  send?: AuthEmailSender
  webhookId: string
}) {
  const env = input.env || process.env
  const config = getEmailConfig(env)
  const supabaseUrl = requiredText(env.SUPABASE_URL, 'SUPABASE_URL')
  const parsedTimeout = Number(env.SUPABASE_EMAIL_PROVIDER_TIMEOUT_MS || 1_250)
  const providerTimeoutMs = Number.isFinite(parsedTimeout)
    ? Math.max(500, Math.min(1_400, Math.round(parsedTimeout)))
    : 1_250
  const messages = buildSupabaseAuthMessages(input.payload, supabaseUrl)
  const sender = input.send || sendEmail

  return Promise.all(messages.map(async (message) => {
    const rendered = <AuthActionEmail
      actionLabel={message.actionLabel}
      actionUrl={message.actionUrl}
      body={message.body}
      code={message.code}
      heading={message.heading}
      logoUrl={config.logoUrl}
      preview={message.subject}
    />
    const emailPayload: EmailPayload = {
      from: config.from,
      to: [message.recipient],
      subject: message.subject,
      html: await render(rendered),
      text: await render(rendered, { plainText: true }),
      replyTo: config.replyTo,
    }
    return sender(emailPayload, {
      event: `supabase_auth.${input.payload.email_data.email_action_type}`,
      idempotencyKey: `supabase-auth:${input.webhookId}:${message.suffix}:${message.recipient}`,
      providerTimeoutMs,
    })
  }))
}
