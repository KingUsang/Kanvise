export type EmailConfig = {
  resendApiKey?: string
  brevoApiKey?: string
  mailjetApiKey?: string
  mailjetSecretKey?: string
  providerOrder: EmailProviderName[]
  providerTimeoutMs: number
  providerDailyLimits: Record<EmailProviderName, number>
  providerUsageThresholdPercent: number
  from: string
  replyTo?: string
  logoUrl: string
}

export type EmailProviderName = 'resend' | 'brevo' | 'mailjet'

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`${name} is required for email delivery`)
  }
  return value.trim()
}

function boundedNumber(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.round(parsed))) : fallback
}

export function getEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const frontendUrl = required('FRONTEND_URL', env.FRONTEND_URL).replace(/\/$/, '')
  const resendApiKey = env.RESEND_API_KEY?.trim() || undefined
  const brevoApiKey = env.BREVO_API_KEY?.trim() || undefined
  const mailjetApiKey = env.MAILJET_API_KEY?.trim() || undefined
  const mailjetSecretKey = env.MAILJET_SECRET_KEY?.trim() || undefined
  if (Boolean(mailjetApiKey) !== Boolean(mailjetSecretKey)) {
    throw new Error('MAILJET_API_KEY and MAILJET_SECRET_KEY must be configured together')
  }
  if (!resendApiKey && !brevoApiKey && !mailjetApiKey) {
    throw new Error('At least one email provider must be configured')
  }
  const configured = new Set<EmailProviderName>([
    ...(resendApiKey ? ['resend' as const] : []),
    ...(brevoApiKey ? ['brevo' as const] : []),
    ...(mailjetApiKey ? ['mailjet' as const] : []),
  ])
  const requestedOrder = (env.EMAIL_PROVIDER_ORDER || 'resend,brevo,mailjet')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is EmailProviderName => (
      value === 'resend' || value === 'brevo' || value === 'mailjet'
    ))
  const providerOrder = [...new Set(requestedOrder)].filter((provider) => configured.has(provider))
  for (const provider of configured) if (!providerOrder.includes(provider)) providerOrder.push(provider)

  const providerTimeoutMs = boundedNumber(env.EMAIL_PROVIDER_TIMEOUT_MS, 3_500, 500, 10_000)

  return {
    resendApiKey,
    brevoApiKey,
    mailjetApiKey,
    mailjetSecretKey,
    providerOrder,
    providerTimeoutMs,
    providerDailyLimits: {
      resend: boundedNumber(env.RESEND_DAILY_LIMIT, 100, 1, 10_000_000),
      brevo: boundedNumber(env.BREVO_DAILY_LIMIT, 300, 1, 10_000_000),
      mailjet: boundedNumber(env.MAILJET_DAILY_LIMIT, 200, 1, 10_000_000),
    },
    providerUsageThresholdPercent: boundedNumber(env.EMAIL_PROVIDER_USAGE_THRESHOLD_PERCENT, 95, 1, 100),
    from: required('EMAIL_FROM', env.EMAIL_FROM),
    replyTo: env.EMAIL_REPLY_TO?.trim() || undefined,
    logoUrl: env.EMAIL_LOGO_URL?.trim() || `${frontendUrl}/kanvise_logo_small_blue.png`,
  }
}
