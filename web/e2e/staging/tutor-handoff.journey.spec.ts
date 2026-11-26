import { test, expect } from './fixtures'
import { recordActivatedTutor, recordPendingAuthUser } from './support/evidence'
import { taggedMailbox, waitForInvitationLink } from './support/gmail'
import { loadManifest, updateManifest } from './support/run-manifest'

test('[J03] invited tutor accepts the delivered email in a separate browser context and receives one subject', async ({ browser, page }) => {
  test.setTimeout(210_000)
  const manifest = await loadManifest()
  const tenant = manifest.tenants[0]
  const course = manifest.database.find((item) => item.table === 'courses')
  expect(tenant).toBeTruthy()
  expect(course).toBeTruthy()
  const email = taggedMailbox(process.env.E2E_GMAIL_ADDRESS!, manifest.runId, 'tutor')
  const requestedAt = new Date(Date.now() - 5_000)

  await page.goto('/dashboard/tutors')
  await page.getByLabel('Email Address').fill(email)
  await page.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByText('Invitation emailed to the tutor')).toBeVisible({ timeout: 30_000 })
  const delivered = await waitForInvitationLink(email, {
    after: requestedAt,
    expectedOrigin: new URL(process.env.E2E_BASE_URL!).origin,
  })
  await updateManifest((current) => { current.providers.push({ provider: 'gmail', kind: 'tutor-invitation', id: delivered.messageId }) })

  const tutorContext = await browser.newContext()
  const tutorPage = await tutorContext.newPage()
  await tutorPage.goto(delivered.link)
  await expect(tutorPage.getByRole('heading', { name: new RegExp(`Join ${tenant.name}`) })).toBeVisible()
  await tutorPage.getByRole('button', { name: 'Continue to account setup' }).click()
  await tutorPage.waitForURL(/\/auth\/complete-invitation\?token=/, { timeout: 60_000 })
  await expect.poll(async () => {
    try { return Boolean(await recordPendingAuthUser(email)) } catch { return false }
  }, { timeout: 30_000 }).toBe(true)
  await tutorPage.getByLabel('Create password').fill(process.env.E2E_ACCOUNT_PASSWORD!)
  await tutorPage.getByLabel('Confirm password').fill(process.env.E2E_ACCOUNT_PASSWORD!)
  await tutorPage.getByRole('button', { name: 'Complete account' }).click()
  await tutorPage.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 60_000 })
  await tutorContext.storageState({ path: process.env.E2E_TUTOR_STATE_PATH || `/tmp/${manifest.runId}.tutor-state.json` })
  await tutorContext.close()

  await page.reload()
  await expect(page.getByText('Journey Tutor')).toBeVisible({ timeout: 30_000 })
  await page.getByLabel(new RegExp(`Assign a tutor to`)).selectOption({ label: 'Journey Tutor' })
  await expect(page.getByText('Tutor assigned to Subject')).toBeVisible({ timeout: 30_000 })
  const evidence = await recordActivatedTutor(email, tenant.id, course!.id)
  expect(evidence.assignment.course_id).toBe(course!.id)
})
