import { test, expect } from './fixtures'
import { recordPendingAuthUser, recordRegisteredCentre } from './support/evidence'
import { taggedMailbox, waitForVerificationCode } from './support/gmail'
import { taggedValue, updateManifest } from './support/run-manifest'

test('[J01] a new centre admin activates through the delivered Gmail verification code', async ({ page }) => {
  test.setTimeout(180_000)
  const runId = process.env.E2E_RUN_ID!
  const email = taggedMailbox(process.env.E2E_GMAIL_ADDRESS!, runId, 'admin')
  const centreName = taggedValue(runId, 'Learning Centre')
  const password = process.env.E2E_ACCOUNT_PASSWORD!
  const requestedAt = new Date(Date.now() - 5_000)

  await page.goto('/auth/register')
  await page.getByRole('button', { name: /I run a tutorial centre/i }).click()
  await page.getByLabel('Tutorial centre name').fill(centreName)
  await page.getByLabel('First name').fill('Journey')
  await page.getByLabel('Last name').fill('Admin')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await expect.poll(async () => {
    try { return Boolean(await recordPendingAuthUser(email)) } catch { return false }
  }, { timeout: 30_000 }).toBe(true)

  const delivered = await waitForVerificationCode(email, { after: requestedAt })
  await updateManifest((manifest) => {
    manifest.providers.push({ provider: 'gmail', kind: 'verification-message', id: delivered.messageId })
  })
  await page.getByLabel('Verification code').fill(delivered.code)
  await page.getByRole('button', { name: 'Verify email' }).click()
  await page.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 60_000 })
  await expect(page.getByText(centreName, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
  await page.context().storageState({ path: process.env.E2E_AUTH_STATE_PATH || `/tmp/${runId}.admin-state.json` })

  const evidence = await recordRegisteredCentre(email, centreName)
  expect(evidence.school.name).toBe(centreName)
})
