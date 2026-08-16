import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/api', () => ({ getApiUrl: () => 'https://api.kanvise.test' }))
import { detachBrowserPushOnLogout, disableBrowserPush, enableBrowserPush, getBrowserPushState } from './push-notifications'

const unsubscribe = vi.fn(async () => true)
const subscription = {
  endpoint: 'https://push.test/device',
  toJSON: () => ({ endpoint: 'https://push.test/device', expirationTime: null, keys: { p256dh: 'key', auth: 'auth' } }),
  unsubscribe,
}
const subscribe = vi.fn(async () => subscription)
const getSubscription = vi.fn<() => Promise<typeof subscription | null>>()
const worker = { pushManager: { subscribe, getSubscription } }

describe('browser push management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSubscription.mockResolvedValue(null)
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} })
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'default', requestPermission: vi.fn(async () => 'granted') } })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register: vi.fn(async () => worker), ready: Promise.resolve(worker) },
    })
  })

  it('requests permission from a user action and registers the subscription server-side', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { enabled: true, publicKey: 'AQID' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { enabled: true } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await enableBrowserPush('token')
    expect(window.Notification.requestPermission).toHaveBeenCalledOnce()
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) }))
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.kanvise.test/users/me/push/subscriptions', expect.objectContaining({ method: 'PUT' }))
  })

  it('reports an existing granted subscription as enabled', async () => {
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'granted', requestPermission: vi.fn() } })
    getSubscription.mockResolvedValue(subscription)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { enabled: true, publicKey: 'AQID' } }), { status: 200 })))
    await expect(getBrowserPushState('token')).resolves.toBe('enabled')
  })

  it('unsubscribes locally even if server cleanup fails during logout', async () => {
    getSubscription.mockResolvedValue(subscription)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(detachBrowserPushOnLogout('token')).resolves.toBeUndefined()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('deletes the server row before disabling a device subscription', async () => {
    getSubscription.mockResolvedValue(subscription)
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await disableBrowserPush('token')
    expect(fetchMock).toHaveBeenCalledWith('https://api.kanvise.test/users/me/push/subscriptions', expect.objectContaining({ method: 'DELETE' }))
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
