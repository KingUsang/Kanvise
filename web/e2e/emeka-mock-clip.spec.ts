import { expect, test } from '@playwright/test'

test('records Emeka taking the Physics mock', async ({ browser }, testInfo) => {
  test.setTimeout(180_000)
  const baseURL = process.env.E2E_BASE_URL!
  const login = await browser.newContext({ baseURL })
  const loginPage = await login.newPage()
  await loginPage.goto('/auth/login')
  await loginPage.locator('input[type="email"]').fill('emeka@demo.com')
  await loginPage.locator('input[type="password"]').fill('Password123!')
  await loginPage.locator('form button[type="submit"]').click()
  await loginPage.waitForURL(/\/dashboard/)
  const state = testInfo.outputPath('emeka-state.json')
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
  // The dashboard immediately normalizes the student route after hydration;
  // wait for the first document commit instead of treating that redirect as a
  // failed navigation on slower staging browsers.
  await page.goto('/dashboard/student/mocks', { waitUntil: 'commit' })
  await page.getByRole('button', { name: /^Available/ }).click()
  const card = page.locator('article', { hasText: "Today's Physics Mock" })
  await card.getByRole('link', { name: 'View instructions' }).click()
  await page.getByLabel(/starting begins my attempt/i).check()
  await page.getByRole('button', { name: 'Start mock' }).click()
  await expect(page.getByText(/Question 1 of/)).toBeVisible()
  await page.waitForTimeout(2_000)
  for (let i = 0; i < 8; i += 1) { await page.keyboard.press(i === 0 ? 'a' : i % 2 === 0 ? 'b' : 'a'); if (i < 7) await page.keyboard.press('ArrowRight') }
  await page.getByRole('button', { name: 'Review' }).last().click()
  await page.getByRole('button', { name: 'Submit final answers' }).click()
  await page.waitForURL(/\/result\//)
  await page.waitForTimeout(3_000)
  await context.close()
  await video.saveAs(testInfo.outputPath('emeka-mock-clip.webm'))
})
