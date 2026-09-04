import webpush from 'web-push'

export type PushConfig = { enabled: boolean; publicKey: string | null }

let configured = false

export function getPushConfig(env: NodeJS.ProcessEnv = process.env): PushConfig {
  const enabled = env.WEB_PUSH_ENABLED === 'true'
  return { enabled, publicKey: enabled ? env.WEB_PUSH_VAPID_PUBLIC_KEY || null : null }
}

export function configureWebPush(env: NodeJS.ProcessEnv = process.env): PushConfig {
  const config = getPushConfig(env)
  if (!config.enabled) return config
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY
  const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY
  const subject = env.WEB_PUSH_SUBJECT
  if (!publicKey || !privateKey || !subject) throw new Error('Web Push is enabled but VAPID configuration is incomplete')
  if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
    throw new Error('WEB_PUSH_SUBJECT must be a mailto: or https: URI')
  }
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    configured = true
  }
  return config
}
