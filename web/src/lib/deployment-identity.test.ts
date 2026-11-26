import { describe, expect, it } from 'vitest'
import { deploymentIdentity } from './deployment-identity'

describe('deploymentIdentity', () => {
  it('prefers Vercel commit metadata', () => {
    expect(deploymentIdentity({
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      VERCEL_GIT_COMMIT_SHA: 'web-sha',
      GITHUB_SHA: 'fallback-sha',
    } as NodeJS.ProcessEnv)).toEqual({ environment: 'preview', release_sha: 'web-sha' })
  })

  it('does not invent a release identity', () => {
    expect(deploymentIdentity({} as NodeJS.ProcessEnv).release_sha).toBeNull()
  })
})
