import { getApiUrl } from '@/config/api'

export type BrowserPushState = 'loading' | 'unsupported' | 'blocked' | 'disabled' | 'enabled' | 'unavailable'

function supported() {
  return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const raw = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

async function registration() {
  await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
  return navigator.serviceWorker.ready
}

async function config(token: string) {
  const response = await fetch(`${getApiUrl()}/users/me/push/config`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'Could not load browser notification settings')
  return body.data as { enabled: boolean; publicKey: string | null }
}

export async function getBrowserPushState(token: string): Promise<BrowserPushState> {
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const pushConfig = await config(token)
  if (!pushConfig.enabled || !pushConfig.publicKey) return 'unavailable'
  const subscription = await (await registration()).pushManager.getSubscription()
  return subscription && Notification.permission === 'granted' ? 'enabled' : 'disabled'
}

export async function enableBrowserPush(token: string): Promise<void> {
  if (!supported()) throw new Error('Browser notifications are not supported on this device.')
  const pushConfig = await config(token)
  if (!pushConfig.enabled || !pushConfig.publicKey) throw new Error('Browser notifications are not available yet.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Notifications are blocked in your browser settings.' : 'Notification permission was not granted.')
  const worker = await registration()
  let subscription = await worker.pushManager.getSubscription()
  const created = !subscription
  if (!subscription) {
    subscription = await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(pushConfig.publicKey) })
  }
  const response = await fetch(`${getApiUrl()}/users/me/push/subscriptions`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (!response.ok) {
    if (created) await subscription.unsubscribe().catch(() => false)
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || 'Could not enable browser notifications')
  }
}

export async function disableBrowserPush(token: string): Promise<void> {
  if (!supported()) return
  const subscription = await (await registration()).pushManager.getSubscription()
  if (!subscription) return
  const response = await fetch(`${getApiUrl()}/users/me/push/subscriptions`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || 'Could not disable browser notifications')
  }
  await subscription.unsubscribe()
}

export async function detachBrowserPushOnLogout(token: string | null | undefined): Promise<void> {
  if (!supported()) return
  try {
    const subscription = await (await registration()).pushManager.getSubscription().catch(() => null)
    if (!subscription) return
    if (token) {
      await fetch(`${getApiUrl()}/users/me/push/subscriptions`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => null)
    }
    await subscription.unsubscribe().catch(() => false)
  } catch { /* logout must never be blocked by push cleanup */ }
}
