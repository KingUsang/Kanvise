import { readFile } from 'node:fs/promises'
import { test as base, expect, type Browser } from '@playwright/test'
import { updateManifest } from './support/run-manifest'

type Fixtures = { remoteBrowser: Browser }

const test = base.extend<Fixtures>({
  remoteBrowser: async ({ playwright }, run, testInfo) => {
    const username = process.env.BROWSERSTACK_USERNAME
    const accessKey = process.env.BROWSERSTACK_ACCESS_KEY
    // Projects for this spec exist only when real devices are enabled, so
    // missing credentials here mean E2E_REQUIRE_REAL_DEVICES=true is unmet.
    if (!username || !accessKey) throw new Error('BrowserStack credentials are required when real-device journeys are enabled')
    const pixel = testInfo.project.name.includes('pixel')
    const caps = {
      browser: 'chrome',
      deviceName: pixel ? 'Google Pixel 9' : 'Samsung Galaxy S25 Ultra',
      osVersion: pixel ? '16.0' : '15.0',
      realMobile: 'true',
      name: testInfo.title,
      build: `Kanvise ${process.env.E2E_RUN_ID}`,
      'browserstack.username': username,
      'browserstack.accessKey': accessKey,
      'browserstack.debug': 'true',
      'browserstack.video': 'true',
      'browserstack.console': 'info',
      'browserstack.networkLogs': 'true',
      'client.playwrightVersion': '1.latest',
    }
    const browser = await playwright.chromium.connect({
      wsEndpoint: `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`,
    })
    await run(browser)
    await browser.close()
  },
})

async function state(file: string | undefined) {
  if (!file) throw new Error('Role storage state path is required for BrowserStack')
  return JSON.parse(await readFile(file, 'utf8'))
}

test('[BS01] real Android Chrome preserves critical tutor and student navigation', async ({ remoteBrowser }, testInfo) => {
  test.setTimeout(180_000)
  const baseURL = process.env.E2E_BASE_URL!
  const tutor = await remoteBrowser.newContext({ baseURL, storageState: await state(process.env.E2E_TUTOR_STATE_PATH) })
  const tutorPage = await tutor.newPage()
  await tutorPage.goto('/dashboard/classes')
  await expect(tutorPage.getByRole('heading', { name: /classes/i }).first()).toBeVisible({ timeout: 45_000 })
  await expect(tutorPage.locator('main')).not.toHaveCSS('overflow-x', 'scroll')
  await tutor.close()

  const student = await remoteBrowser.newContext({ baseURL, storageState: await state(process.env.E2E_STUDENT_STATE_PATH) })
  const studentPage = await student.newPage()
  await studentPage.goto('/dashboard/student/assignments')
  await expect(studentPage.getByRole('heading', { name: 'Assignments' })).toBeVisible({ timeout: 45_000 })
  await expect(studentPage.getByText(/E2E-.*-Assignment/).first()).toBeVisible()
  await studentPage.goto('/dashboard/student/classes')
  await expect(studentPage.getByRole('heading', { name: /classes/i }).first()).toBeVisible({ timeout: 45_000 })
  await student.close()

  await updateManifest((manifest) => {
    manifest.providers.push({
      provider: 'browserstack',
      kind: 'real-android-session',
      id: `${manifest.runId}-${testInfo.project.name}`,
      metadata: { project: testInfo.project.name },
    })
  })
})
