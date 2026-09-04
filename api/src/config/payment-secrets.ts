const placeholders = /^(placeholder|change[-_]?me|your[-_]|test[-_]?secret|secret$)/i

export function isUnsafeSecret(value: string | undefined): boolean {
  return !value?.trim() || value.trim().length < 24 || placeholders.test(value.trim())
}

export function validateProductionPaymentSecrets(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return
  if (isUnsafeSecret(env.PAYSTACK_SECRET_KEY)) throw new Error('PAYSTACK_SECRET_KEY is missing or unsafe in production')
  if (isUnsafeSecret(env.KANVISE_INTERNAL_SECRET)) throw new Error('KANVISE_INTERNAL_SECRET is missing or unsafe in production')
}

