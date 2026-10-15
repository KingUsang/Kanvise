import { Hono } from 'hono'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const healthRouter = new Hono()

function releaseMetadata() {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', 'release.json'), 'utf8')) as {
      release_sha: string
      environment: string
    }
  } catch {
    return {
      release_sha: process.env.RELEASE_SHA || 'unknown',
      environment: process.env.DEPLOY_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
    }
  }
}

healthRouter.get('/', (c) => {
  const release = releaseMetadata()
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: release.environment,
    release_sha: release.release_sha,
  })
})
