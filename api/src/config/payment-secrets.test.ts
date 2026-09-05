import { describe, expect, it } from 'vitest'
import { validateProductionPaymentSecrets } from './payment-secrets'

describe('validateProductionPaymentSecrets', () => {
  it('rejects missing and placeholder production secrets', () => {
    expect(() => validateProductionPaymentSecrets({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow('PAYSTACK_SECRET_KEY')
    expect(() => validateProductionPaymentSecrets({
      NODE_ENV: 'production', PAYSTACK_SECRET_KEY: 'sk_live_production_secret_abcdefghijklmnopqrstuvwxyz', KANVISE_INTERNAL_SECRET: 'change-me',
    } as NodeJS.ProcessEnv)).toThrow('KANVISE_INTERNAL_SECRET')
  })

  it('accepts strong production secrets', () => {
    expect(() => validateProductionPaymentSecrets({
      NODE_ENV: 'production',
      PAYSTACK_SECRET_KEY: 'sk_live_production_secret_abcdefghijklmnopqrstuvwxyz',
      KANVISE_INTERNAL_SECRET: '9dff4bf1e998ea69922c6d21f782ef35',
    } as NodeJS.ProcessEnv)).not.toThrow()
  })
})
