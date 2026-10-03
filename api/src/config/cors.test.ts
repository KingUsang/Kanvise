import { describe, expect, it } from 'vitest'
import { getAllowedOrigins, resolveCorsOrigin } from './cors'

describe('CORS origin configuration', () => {
  const env = {
    FRONTEND_URL: 'https://kanvise.com/',
    CORS_ALLOWED_ORIGINS: 'https://staging.kanvise.com, https://app.kanvise.com/',
  } as NodeJS.ProcessEnv

  it('allows the canonical frontend and configured subdomains', () => {
    expect(getAllowedOrigins(env)).toEqual(new Set([
      'https://kanvise.com',
      'https://staging.kanvise.com',
      'https://app.kanvise.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3100',
      'http://127.0.0.1:3100',
    ]))
    expect(resolveCorsOrigin('https://staging.kanvise.com', env)).toBe('https://staging.kanvise.com')
    expect(resolveCorsOrigin('http://127.0.0.1:3000', env)).toBe('http://127.0.0.1:3000')
    expect(resolveCorsOrigin('http://127.0.0.1:3100', env)).toBe('http://127.0.0.1:3100')
  })

  it('allows HTTPS Vercel preview origins', () => {
    expect(resolveCorsOrigin('https://kanvise-git-feature-team.vercel.app', env))
      .toBe('https://kanvise-git-feature-team.vercel.app')
  })

  it('rejects unconfigured origins instead of returning a different origin', () => {
    expect(resolveCorsOrigin('https://attacker.example', env)).toBeUndefined()
    expect(resolveCorsOrigin('http://fake.vercel.app', env)).toBeUndefined()
  })
})
