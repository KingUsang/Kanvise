import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function envValue(name: string) {
  const match = readFileSync('web/.env.local', 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'))
  if (!match) throw new Error(`Missing ${name} in web/.env.local`)
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

test('records tutor entering a live class on mobile', async ({ browser }, testInfo) => {
  test.setTimeout(8 * 60_000)
  const baseURL = process.env.E2E_BASE_URL!
  const url = envValue('NEXT_PUBLIC_SUPABASE_URL')
  const auth = createClient(url, envValue('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await auth.auth.signInWithPassword({ email: 'tutor@demo.com', password: 'Password123!' })
  if (error || !data.session) throw error ?? new Error('Could not create tutor recording session')
  const value = `base64-${Buffer.from(JSON.stringify(data.session)).toString('base64url')}`
  const projectRef = new URL(url).hostname.split('.')[0]
  const context = await browser.newContext({ baseURL, viewport: { width: 393, height: 851 }, deviceScaleFactor: 1, hasTouch: true, permissions: ['camera', 'microphone'], recordVideo: { dir: testInfo.outputPath('video'), size: { width: 393, height: 851 } } })
  await context.addCookies(Array.from({ length: Math.ceil(value.length / 3000) }, (_, index) => ({ name: `sb-${projectRef}-auth-token.${index}`, value: value.slice(index * 3000, (index + 1) * 3000), url: baseURL, sameSite: 'Lax' as const })))
  const page = await context.newPage()
  page.setDefaultTimeout(35_000)
  const video = page.video()!
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Start live class' })).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1_000)
  await page.getByRole('button', { name: 'Start live class' }).click()
  await page.getByRole('button', { name: /enrolled learners/i }).click()
  const subject = page.getByLabel('Subject')
  await expect(subject).toBeVisible()
  await subject.selectOption({ label: 'Physics' })
  await page.getByRole('button', { name: /start class now/i }).click()
  await page.waitForURL(/\/class\/[^?]+\?start=true/)
  await expect(page.getByRole('button', { name: 'Join as a listener' })).toBeVisible({ timeout: 50_000 })
  await page.waitForTimeout(2_000)
  await page.getByRole('button', { name: 'Join as a listener' }).click()
  await page.waitForTimeout(5_000)
  await context.close()
  await video.saveAs(testInfo.outputPath('tutor-mobile-class-clip.webm'))
})
