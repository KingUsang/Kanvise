import webpush from 'web-push'
import { vapidKeysMatch } from './vapid'

export type PushConfig = { enabled: boolean; publicKey: string | null }

let configured = false

export function getPushConfig(env: NodeJS.ProcessEnv = process.env): PushConfig {
  // Enabled only with a usable key pair, so the feature is not advertised and
  // subscriptions are not accepted when delivery could never succeed (DEV-PSH-004).
  const enabled = env.WEB_PUSH_ENABLED === 'true'
    && vapidKeysMatch(env.WEB_PUSH_VAPID_PUBLIC_KEY, env.WEB_PUSH_VAPID_PRIVATE_KEY)
  return { enabled, publicKey: enabled ? env.WEB_PUSH_VAPID_PUBLIC_KEY || null : null }
}

export function configureWebPush(env: NodeJS.ProcessEnv = process.env): PushConfig {
  if (env.WEB_PUSH_ENABLED !== 'true') return getPushConfig(env)
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY
  const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY
  const subject = env.WEB_PUSH_SUBJECT
  if (!publicKey || !privateKey || !subject) throw new Error('Web Push is enabled but VAPID configuration is incomplete')
  if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
    throw new Error('WEB_PUSH_SUBJECT must be a mailto: or https: URI')
  }
  if (!vapidKeysMatch(publicKey, privateKey)) throw new Error('WEB_PUSH_VAPID_PRIVATE_KEY does not match WEB_PUSH_VAPID_PUBLIC_KEY')
  const config = getPushConfig(env)
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    configured = true
  }
  return config
}
