/* Kanvise service worker: push notifications only. Intentionally no fetch handler or offline cache. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

function safePath(value) {
  try {
    const url = new URL(typeof value === 'string' ? value : '/dashboard', self.location.origin)
    return url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : '/dashboard'
  } catch {
    return '/dashboard'
  }
}

self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = {} }
  const title = typeof payload.title === 'string' ? payload.title : 'Kanvise'
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'You have a new update.',
    icon: '/icons/icon-192.png',
    badge: '/icons/notification-badge-96.png',
    tag: typeof payload.tag === 'string' ? payload.tag : undefined,
    renotify: false,
    data: { url: safePath(payload.url) },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const destination = safePath(event.notification.data && event.notification.data.url)
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (existing) {
      await existing.navigate(destination)
      return existing.focus()
    }
    return self.clients.openWindow(destination)
  })())
})
