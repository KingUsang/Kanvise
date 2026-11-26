import { test as base } from '@playwright/test'
import { updateManifest } from './support/run-manifest'

export const test = base.extend({
  page: async ({ page }, runFixture, testInfo) => {
    const browserEvents: string[] = []
    const failedRequests: Array<{ method: string; url: string; error: string | null }> = []
    const startedAt = Date.now()

    await updateManifest((manifest) => {
      manifest.events.push({ at: new Date().toISOString(), journey: testInfo.titlePath.join(' > '), action: 'started' })
    })

    page.on('console', (message) => browserEvents.push(`[${message.type()}] ${message.text()}`))
    page.on('pageerror', (error) => browserEvents.push(`[pageerror] ${error.stack || error.message}`))
    page.on('requestfailed', (request) => failedRequests.push({
      method: request.method(),
      url: request.url(),
      error: request.failure()?.errorText || null,
    }))

    await runFixture(page)

    await testInfo.attach('browser-events.json', {
      body: Buffer.from(JSON.stringify(browserEvents, null, 2)),
      contentType: 'application/json',
    })
    await testInfo.attach('failed-requests.json', {
      body: Buffer.from(JSON.stringify(failedRequests, null, 2)),
      contentType: 'application/json',
    })
    await testInfo.attach('timing.json', {
      body: Buffer.from(JSON.stringify({ duration_ms: Date.now() - startedAt }, null, 2)),
      contentType: 'application/json',
    })
    await updateManifest((manifest) => {
      manifest.events.push({
        at: new Date().toISOString(),
        journey: testInfo.titlePath.join(' > '),
        action: 'finished',
        detail: { status: testInfo.status, duration_ms: Date.now() - startedAt, retry: testInfo.retry },
      })
      if (testInfo.status && testInfo.status !== 'passed') manifest.status = 'failed'
    })
  },
})

export { expect } from '@playwright/test'
