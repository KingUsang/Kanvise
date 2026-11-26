import { test, expect } from './fixtures'

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  await expect.poll(() => page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))).toMatchObject({ documentWidth: await page.evaluate(() => document.documentElement.clientWidth) })
}

test('[UX01] registration keeps its primary action visible, focusable, and inside the viewport', async ({ page }) => {
  await page.goto('/auth/register')
  await expect(page.getByRole('heading', { name: 'Set up your school' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const centreChoice = page.getByRole('button', { name: /I run a tutorial centre/i })
  await expect(centreChoice).toBeInViewport()
  await centreChoice.focus()
  await expect(centreChoice).toBeFocused()
  await centreChoice.click()

  const email = page.getByLabel('Email address')
  await email.focus()
  await expect(email).toBeFocused()
  const submit = page.getByRole('button', { name: 'Create account' })
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeInViewport()
  await expectNoHorizontalOverflow(page)
})

test('[UX01] public landing page has no horizontal overflow or hidden main call to action', async ({ page }) => {
  await page.goto('/')
  await expectNoHorizontalOverflow(page)
  const primaryAction = page.getByRole('button', { name: /join waitlist/i }).first()
  await expect(primaryAction).toBeVisible()
  await primaryAction.scrollIntoViewIfNeeded()
  await expect(primaryAction).toBeInViewport()
})
