import { expect, test } from '@playwright/test'

test.describe('PWA readiness', () => {
  test('publishes an installable role-aware manifest and required icons', async ({ request }) => {
    const home = await request.get('/')
    expect(home.ok()).toBeTruthy()
    expect(await home.text()).toContain('rel="manifest" href="/manifest.webmanifest"')
    const response = await request.get('/manifest.webmanifest')
    expect(response.ok()).toBeTruthy()
    const manifest = await response.json()
    expect(manifest).toMatchObject({ name: 'Kanvise', start_url: '/dashboard', scope: '/', display: 'standalone' })
    for (const icon of manifest.icons) {
      const iconResponse = await request.get(icon.src)
      expect(iconResponse.ok(), `${icon.src} should be available`).toBeTruthy()
      expect(iconResponse.headers()['content-type']).toContain('image/png')
    }
  })

  test('serves a non-cacheable push-only service worker', async ({ request }) => {
    const response = await request.get('/sw.js')
    expect(response.ok()).toBeTruthy()
    expect(response.headers()['content-type']).toContain('application/javascript')
    expect(response.headers()['cache-control']).toContain('no-cache')
    const source = await response.text()
    expect(source).toContain("addEventListener('push'")
    expect(source).toContain("addEventListener('notificationclick'")
    expect(source).not.toContain("addEventListener('fetch'")
    expect(source).not.toContain('caches.')
  })
})
