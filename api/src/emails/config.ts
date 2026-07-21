export type EmailConfig = {
  apiKey: string
  from: string
  replyTo?: string
  logoUrl: string
}

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`${name} is required for email delivery`)
  }
  return value.trim()
}

export function getEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const frontendUrl = required('FRONTEND_URL', env.FRONTEND_URL).replace(/\/$/, '')

  return {
    apiKey: required('RESEND_API_KEY', env.RESEND_API_KEY),
    from: required('EMAIL_FROM', env.EMAIL_FROM),
    replyTo: env.EMAIL_REPLY_TO?.trim() || undefined,
    logoUrl: env.EMAIL_LOGO_URL?.trim() || `${frontendUrl}/kanvise_logo_small_blue.png`,
  }
}
