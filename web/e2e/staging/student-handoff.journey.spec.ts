import { test, expect } from './fixtures'
import { recordActivatedStudent, recordPendingAuthUser } from './support/evidence'
import { taggedMailbox, waitForInvitationLink } from './support/gmail'
import { loadManifest, updateManifest } from './support/run-manifest'

test('[J03] invited student accepts the delivered link in a separate browser context', async ({ browser, page }) => {
  test.setTimeout(210_000)
  const manifest = await loadManifest()
  const tenant = manifest.tenants[0]
  const programme = manifest.database.find((item) => item.table === 'programmes')
  expect(tenant).toBeTruthy()
  expect(programme).toBeTruthy()
  const email = taggedMailbox(process.env.E2E_GMAIL_ADDRESS!, manifest.runId, 'student')
  const requestedAt = new Date(Date.now() - 5_000)

  await page.goto(`/dashboard/classes/${programme!.id}?tab=learners`)
  await page.getByRole('button', { name: 'Add student', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add student' })
  await dialog.getByLabel('First name').fill('Journey')
  await dialog.getByLabel('Last name').fill('Student')
  await dialog.getByLabel('Email address').fill(email)
  await dialog.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByText('Student added and invitation sent')).toBeVisible({ timeout: 30_000 })

  const delivered = await waitForInvitationLink(email, {
    after: requestedAt,
    expectedOrigin: new URL(process.env.E2E_BASE_URL!).origin,
  })
  await updateManifest((current) => current.providers.push({ provider: 'gmail', kind: 'student-invitation', id: delivered.messageId }))

  const studentContext = await browser.newContext()
  const studentPage = await studentContext.newPage()
  await studentPage.goto(delivered.link)
  await expect(studentPage.getByRole('heading', { name: new RegExp(`Join ${tenant.name}`) })).toBeVisible()
  await studentPage.getByRole('button', { name: 'Continue to account setup' }).click()
  await studentPage.waitForURL(/\/auth\/complete-invitation\?token=/, { timeout: 60_000 })
  await expect(studentPage.getByRole('heading', { name: 'Finish your account' })).toBeVisible()
  await expect.poll(async () => {
    try { return Boolean(await recordPendingAuthUser(email)) } catch { return false }
  }, { timeout: 30_000 }).toBe(true)
  await studentPage.getByLabel('Create password').fill(process.env.E2E_ACCOUNT_PASSWORD!)
  await studentPage.getByLabel('Confirm password').fill(process.env.E2E_ACCOUNT_PASSWORD!)
  await studentPage.getByRole('button', { name: 'Complete account' }).click()
  await studentPage.waitForURL(/\/dashboard\/student(?:\/|$)/, { timeout: 60_000 })
  await studentContext.storageState({ path: process.env.E2E_STUDENT_STATE_PATH || `/tmp/${manifest.runId}.student-state.json` })

  const evidence = await recordActivatedStudent(email, tenant.id, programme!.id)
  expect(evidence.enrolment.school_id).toBe(tenant.id)
  await studentContext.close()

  const duplicateContext = await browser.newContext()
  const duplicatePage = await duplicateContext.newPage()
  await duplicatePage.goto(delivered.link)
  await expect(duplicatePage.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible()
  await expect(duplicatePage.getByText(/already been accepted/i)).toBeVisible()
  await duplicateContext.close()
})
