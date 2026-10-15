import { afterEach, describe, expect, it, vi } from 'vitest'
import { healthRouter } from './health'

describe('GET /health', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns a public liveness response without external dependencies', async () => {
    vi.stubEnv('RELEASE_SHA', 'abc123')
    vi.stubEnv('DEPLOY_ENVIRONMENT', 'staging')
    const response = await healthRouter.request('/')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      release_sha: 'abc123',
      environment: 'staging',
    })
  })
})
