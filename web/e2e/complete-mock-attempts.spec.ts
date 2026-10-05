import { expect, test } from '@playwright/test'

const learners = [
  { email: 'ada@demo.com', outcome: 'strong' },
  { email: 'tobi@demo.com', outcome: 'average' },
]

test('prepares the remaining scored Physics mock attempts', async ({ browser }) => {
  test.setTimeout(360_000)
  const baseURL = process.env.E2E_BASE_URL!

  for (const learner of learners) {
    const context = await browser.newContext({ baseURL, viewport: { width: 1920, height: 1080 } })
    const page = await context.newPage()
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await page.goto('/auth/login', { waitUntil: 'domcontentloaded' })
        break
      } catch (error) {
        if (!String(error).includes('net::ERR_ABORTED') || attempt === 1) throw error
        await page.waitForTimeout(750)
      }
    }
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(750)
    await page.locator('input[type="email"]').fill(learner.email)
    await page.locator('input[type="password"]').fill('Password123!')
    await page.locator('form button[type="submit"]').click()
    await page.waitForURL(/\/dashboard/)
    // Enter through the product navigation. Directly opening the nested route
    // can be aborted by the dashboard's client-side session normalization on a
    // slow headed browser.
    await page.goto('/dashboard', { waitUntil: 'commit' })
    await expect(page.getByRole('link', { name: 'Mocks', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Mocks', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Mocks', exact: true })).toBeVisible()
    await page.getByRole('button', { name: /^Available/ }).click()
    const card = page.locator('article', { hasText: "Today's Physics Mock" })
    await card.getByRole('link', { name: 'View instructions' }).click()
    await page.getByLabel(/starting begins my attempt/i).check()
    await page.getByRole('button', { name: 'Start mock' }).click()
    await expect(page.getByText(/Question 1 of/)).toBeVisible()
    for (let question = 0; question < 8; question += 1) {
      if (learner.outcome === 'strong' || question % 2 === 0) {
        await page.keyboard.press(question % 2 === 0 ? 'a' : 'b')
      }
      if (question < 7) await page.keyboard.press('ArrowRight')
    }
    await page.getByRole('button', { name: 'Review' }).last().click()
    await page.getByRole('button', { name: 'Submit final answers' }).click()
    await page.waitForURL(/\/dashboard\/student\/mocks\/result\//)
    await context.close()
  }
})
