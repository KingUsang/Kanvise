import { expect, test } from './fixtures'

test('[D00] web and API are the requested staging release', async ({ page, request }) => {
  const expectedSha = process.env.E2E_EXPECTED_SHA!
  const apiUrl = process.env.E2E_API_URL!

  const [webHealth, apiHealth] = await Promise.all([
    request.get('/api/health'),
    request.get(`${apiUrl.replace(/\/$/, '')}/health`),
  ])
  expect(webHealth.ok()).toBeTruthy()
  expect(apiHealth.ok()).toBeTruthy()
  expect((await webHealth.json()).release_sha).toBe(expectedSha)
  expect((await apiHealth.json()).release_sha).toBe(expectedSha)

  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
})
