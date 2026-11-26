export function deploymentIdentity(env: NodeJS.ProcessEnv = process.env) {
  return {
    environment: env.VERCEL_ENV || env.NODE_ENV || 'development',
    release_sha: env.VERCEL_GIT_COMMIT_SHA || env.RELEASE_SHA || env.GITHUB_SHA || null,
  }
}
