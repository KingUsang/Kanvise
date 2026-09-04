const placeholders = /^(placeholder|change[-_]?me|your[-_]|test[-_]?secret|secret$)/i

export function requireWebhookSecrets(env: NodeJS.ProcessEnv = process.env) {
  const paystackSecret = env.PAYSTACK_SECRET_KEY?.trim()
  const internalSecret = env.KANVISE_INTERNAL_SECRET?.trim()
  const production = env.NODE_ENV === 'production'
  const unsafe = (value: string | undefined) => !value || (production && (value.length < 24 || placeholders.test(value)))

  if (unsafe(paystackSecret) || unsafe(internalSecret)) {
    throw new Error('Paystack webhook secrets are missing or unsafe')
  }
  return { paystackSecret: paystackSecret!, internalSecret: internalSecret! }
}

