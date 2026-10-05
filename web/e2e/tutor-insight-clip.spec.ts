import { expect, test } from '@playwright/test'

test('records tutor outcome and intervention clip', async ({ browser }, testInfo) => {
  const baseURL = process.env.E2E_BASE_URL!
  const login = await browser.newContext({ baseURL })
  const loginPage = await login.newPage()
  await loginPage.goto('/auth/login', { waitUntil: 'domcontentloaded' })
  await expect(loginPage.locator('input[type="email"]')).toBeVisible({ timeout: 20_000 })
  await loginPage.waitForTimeout(750)
  await loginPage.locator('input[type="email"]').fill('tutor@demo.com')
  await loginPage.locator('input[type="password"]').fill('Password123!')
  await loginPage.locator('form button[type="submit"]').click()
  await loginPage.waitForURL(/\/dashboard/)
  const state = testInfo.outputPath('tutor-state.json')
  await login.storageState({ path: state })
  await login.close()
  const context = await browser.newContext({ baseURL, storageState: state, viewport: { width: 1920, height: 1080 }, recordVideo: { dir: testInfo.outputPath('video'), size: { width: 1920, height: 1080 } } })
  await context.addInitScript(() => {
    document.addEventListener('pointerdown', event => {
      const cue = document.createElement('span')
      cue.style.cssText = `position:fixed;left:${event.clientX - 18}px;top:${event.clientY - 18}px;width:36px;height:36px;border:3px solid #7c3aed;border-radius:9999px;pointer-events:none;z-index:2147483647;animation:kanvise-click 480ms ease-out forwards`
      document.documentElement.appendChild(cue)
      setTimeout(() => cue.remove(), 500)
    }, true)
    const style = document.createElement('style')
    style.textContent = '@keyframes kanvise-click { from { transform:scale(.25); opacity:1 } to { transform:scale(1.5); opacity:0 } }'
    document.documentElement.appendChild(style)
  })
  const page = await context.newPage()
  const video = page.video()!
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto('/dashboard/mocks', { waitUntil: 'domcontentloaded' })
      break
    } catch (error) {
      if (!String(error).includes('net::ERR_ABORTED') || attempt === 1) throw error
      await page.waitForTimeout(750)
    }
  }
  const mock = page.getByRole('row', { name: /Today's Physics Mock/i })
  await expect(mock).toBeVisible({ timeout: 20_000 })
  await mock.getByRole('button', { name: /view results/i }).click()
  await expect(page.getByRole('heading', { name: 'Mock results' })).toBeVisible()
  await page.waitForTimeout(3_000)
  await page.getByRole('button', { name: 'AI Analyze', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Emeka Okafor needs attention' })).toBeVisible()
  await page.waitForTimeout(5_000)
  await page.getByRole('button', { name: 'Send Support' }).click()
  await page.waitForTimeout(2_000)
  await context.close()
  await video.saveAs(testInfo.outputPath('tutor-insight-clip.webm'))
})
