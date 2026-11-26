import { test, expect } from './fixtures'
import { recordCreatedClass } from './support/evidence'
import { loadManifest, taggedValue } from './support/run-manifest'

test('[J02] centre admin creates a real class and immediately sees the persisted subject', async ({ page }) => {
  const manifest = await loadManifest()
  const tenant = manifest.tenants[0]
  expect(tenant, 'authentication setup must record the centre tenant').toBeTruthy()
  const className = taggedValue(manifest.runId, 'JAMB Class')
  const subjectName = taggedValue(manifest.runId, 'Physics')

  await page.goto('/dashboard/classes/new')
  await expect(page.getByRole('heading', { name: 'Set up the teaching space' })).toBeVisible()
  await page.getByLabel('Class name').fill(className)
  await page.getByRole('button', { name: 'A group of students', exact: true }).click()
  await page.getByRole('button', { name: 'One subject', exact: true }).click()
  await page.getByLabel(/^Subject/).fill(subjectName)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()

  await page.waitForURL(/\/dashboard\/classes\/[0-9a-f-]+(?:\?|$)/, { timeout: 30_000 })
  await expect(page.getByText(className, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(subjectName, { exact: true }).first()).toBeVisible({ timeout: 30_000 })

  const evidence = await recordCreatedClass(tenant.id, className, subjectName)
  expect(evidence.programme.school_id).toBe(tenant.id)

  await page.reload()
  await expect(page.getByText(className, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(subjectName, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
})
