import { describe, expect, it } from 'vitest'
import { healthRouter } from './health'

describe('GET /health', () => {
  it('returns a public liveness response without external dependencies', async () => {
    const response = await healthRouter.request('/')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
  })
})
