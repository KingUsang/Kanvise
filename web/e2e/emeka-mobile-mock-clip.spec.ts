import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function envValue(name: string) {
  const source = readFileSync('web/.env.local', 'utf8')
  const match = source.match(new RegExp(`^${name}=(.+)$`, 'm'))
  if (!match) throw new Error(`Missing ${name} in web/.env.local`)
  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

test('records Emeka taking the Physics mock on mobile', async ({ browser }, testInfo) => {
  // Mobile rendering on this laptop can take longer than desktop; keep the
  // real touch workflow intact rather than terminating a valid recording.
  test.setTimeout(15 * 60_000)
  const baseURL = process.env.E2E_BASE_URL!
  const supabaseUrl = envValue('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseKey = envValue('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const auth = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: sessionData, error: sessionError } = await auth.auth.signInWithPassword({ email: 'emeka@demo.com', password: 'Password123!' })
  if (sessionError || !sessionData.session) throw sessionError ?? new Error('Could not create Emeka recording session')

  const context = await browser.newContext({
    baseURL,
    viewport: { width: 393, height: 851 },
    // The responsive 393px layout is the footage we need. Staging's mobile-UA
    // auth path currently falls back to an anonymous school session, so retain
    // the touch viewport without switching the browser identity.
    deviceScaleFactor: 1,
    hasTouch: true,
    recordVideo: { dir: testInfo.outputPath('video'), size: { width: 393, height: 851 } },
  })
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const serializedSession = `base64-${Buffer.from(JSON.stringify(sessionData.session)).toString('base64url')}`
  const chunkSize = 3000
  await context.addCookies(Array.from({ length: Math.ceil(serializedSession.length / chunkSize) }, (_, index) => ({
    name: `sb-${projectRef}-auth-token.${index}`,
    value: serializedSession.slice(index * chunkSize, (index + 1) * chunkSize),
    url: baseURL,
    sameSite: 'Lax' as const,
  })))
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  const video = page.video()!
  await page.goto('/dashboard/student/mocks', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Open account menu' })).toHaveText(/E/, { timeout: 20_000 })
  await page.getByRole('button', { name: /^Available/ }).click()
  let card = page.locator('article', { hasText: "Today's Physics Mock" })
  const available = await card.getByRole('link', { name: 'View instructions' }).isVisible({ timeout: 3_000 }).catch(() => false)
  if (available) {
    await card.getByRole('link', { name: 'View instructions' }).click()
    await page.getByLabel(/starting begins my attempt/i).check()
    await page.getByRole('button', { name: 'Start mock' }).click()
  } else {
    // A prior interrupted recording leaves the same deterministic attempt in
    // progress. Resume it so the footage remains a real student workflow.
    await page.getByRole('button', { name: /^Continue/ }).click()
    card = page.locator('article', { hasText: "Today's Physics Mock" })
    await card.getByRole('link', { name: 'Continue mock' }).click()
  }
  await expect(page.getByText(/Question 1 of/)).toBeVisible()
  await page.waitForTimeout(1_500)
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press(i === 0 ? 'a' : i % 2 === 0 ? 'b' : 'a')
    if (i < 7) await page.keyboard.press('ArrowRight')
  }
  // The mobile navigation is rendered above the fixed Review control. Trigger
  // that visible control's normal handler rather than sending a pointer into
  // the navigation overlay.
  await page.getByRole('button', { name: 'Review' }).last().evaluate((button: HTMLButtonElement) => button.click())
  await page.getByRole('button', { name: 'Submit final answers' }).click()
  await page.waitForURL(/\/result\//)
  await page.waitForTimeout(2_500)
  await context.close()
  await video.saveAs(testInfo.outputPath('emeka-mobile-mock-clip.webm'))
})
