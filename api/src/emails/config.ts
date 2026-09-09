export type EmailConfig = {
  resendApiKey?: string
  brevoApiKey?: string
  providerOrder: EmailProviderName[]
  providerTimeoutMs: number
  from: string
  replyTo?: string
  logoUrl: string
}

export type EmailProviderName = 'resend' | 'brevo'

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`${name} is required for email delivery`)
  }
  return value.trim()
}

export function getEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const frontendUrl = required('FRONTEND_URL', env.FRONTEND_URL).replace(/\/$/, '')
  const resendApiKey = env.RESEND_API_KEY?.trim() || undefined
  const brevoApiKey = env.BREVO_API_KEY?.trim() || undefined
  if (!resendApiKey && !brevoApiKey) {
    throw new Error('RESEND_API_KEY or BREVO_API_KEY is required for email delivery')
  }
  const configured = new Set<EmailProviderName>([
    ...(resendApiKey ? ['resend' as const] : []),
    ...(brevoApiKey ? ['brevo' as const] : []),
  ])
  const requestedOrder = (env.EMAIL_PROVIDER_ORDER || 'resend,brevo')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is EmailProviderName => value === 'resend' || value === 'brevo')
  const providerOrder = [...new Set(requestedOrder)].filter((provider) => configured.has(provider))
  for (const provider of configured) if (!providerOrder.includes(provider)) providerOrder.push(provider)

  const parsedTimeout = Number(env.EMAIL_PROVIDER_TIMEOUT_MS || 3_500)
  const providerTimeoutMs = Number.isFinite(parsedTimeout)
    ? Math.max(500, Math.min(10_000, Math.round(parsedTimeout)))
    : 3_500

  return {
    resendApiKey,
    brevoApiKey,
    providerOrder,
    providerTimeoutMs,
    from: required('EMAIL_FROM', env.EMAIL_FROM),
    replyTo: env.EMAIL_REPLY_TO?.trim() || undefined,
    logoUrl: env.EMAIL_LOGO_URL?.trim() || `${frontendUrl}/kanvise_logo_small_blue.png`,
  }
}
