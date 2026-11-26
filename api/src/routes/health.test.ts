import { describe, expect, it } from 'vitest'
import { deploymentIdentity, healthRouter } from './health'

describe('GET /health', () => {
  it('returns a public liveness response without external dependencies', async () => {
    const response = await healthRouter.request('/')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
  })

  it('exposes the deployed commit identity without guessing one', () => {
    expect(deploymentIdentity({ NODE_ENV: 'staging', RELEASE_SHA: 'abc123' } as NodeJS.ProcessEnv)).toEqual({
      environment: 'staging',
      release_sha: 'abc123',
    })
    expect(deploymentIdentity({} as NodeJS.ProcessEnv).release_sha).toBeNull()
  })
})
