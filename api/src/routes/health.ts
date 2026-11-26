import { Hono } from 'hono'

export const healthRouter = new Hono()

export function deploymentIdentity(env: NodeJS.ProcessEnv = process.env) {
  return {
    environment: env.NODE_ENV || 'development',
    release_sha: env.RELEASE_SHA || env.GITHUB_SHA || null,
  }
}

healthRouter.get('/', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  ...deploymentIdentity(),
}))
