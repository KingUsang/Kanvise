import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function envValue(name: string) {
  const source = readFileSync('web/.env.local', 'utf8')
  const match = source.match(new RegExp(`^${name}=(.+)$`, 'm'))
  if (!match) throw new Error(`Missing ${name} in web/.env.local`)
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

test('records tutor analytics and intervention on mobile', async ({ browser }, testInfo) => {
  test.setTimeout(8 * 60_000)
  const baseURL = process.env.E2E_BASE_URL!
  const supabaseUrl = envValue('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseKey = envValue('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const auth = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await auth.auth.signInWithPassword({ email: 'tutor@demo.com', password: 'Password123!' })
  if (error || !data.session) throw error ?? new Error('Could not create tutor recording session')
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const session = `base64-${Buffer.from(JSON.stringify(data.session)).toString('base64url')}`
  const context = await browser.newContext({
    baseURL, viewport: { width: 393, height: 851 }, deviceScaleFactor: 1, hasTouch: true,
    recordVideo: { dir: testInfo.outputPath('video'), size: { width: 393, height: 851 } },
  })
  await context.addCookies(Array.from({ length: Math.ceil(session.length / 3000) }, (_, index) => ({
    name: `sb-${projectRef}-auth-token.${index}`, value: session.slice(index * 3000, (index + 1) * 3000),
    url: baseURL, sameSite: 'Lax' as const,
  })))
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  const video = page.video()!
  await page.goto('/dashboard/mocks', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: "Today's Physics Mock" })).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(1_500)
  await page.getByText('View results', { exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Mock results' })).toBeVisible()
  await page.waitForTimeout(2_500)
  await page.getByRole('button', { name: 'AI Analyze', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Emeka Okafor needs attention' })).toBeVisible()
  await page.waitForTimeout(5_000)
  await page.getByRole('button', { name: 'Send Support' }).click()
  await page.waitForTimeout(1_500)
  await context.close()
  await video.saveAs(testInfo.outputPath('tutor-mobile-insight-clip.webm'))
})
