// Build step 2 speed and motion audit (16 R-08, 01 SH-11), run against the
// design previews with motion on (no reduced-motion setting).
//
// Same set-up as step-02-dashboard-setup.mjs. From web/:
//   BASE_URL=http://localhost:3126 node e2e/screenshots/step-02-motion-audit.mjs
// Prints one line per check and exits 1 if any check fails.
import { chromium } from 'playwright'

const base = process.env.BASE_URL || 'http://localhost:3126'
const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: ${detail}`)
}

const browser = await chromium.launch()
try {
  // R-08 timing, for information only. The previews render on the client
  // (overlays are portals), so these numbers include loading the JavaScript.
  // In the app the skeletons come in the server HTML: the dashboard layout
  // streams ShellFirstPaintSkeleton from a Suspense fallback and
  // app/onboarding/loading.tsx streams OnboardingSkeleton (layout.test.tsx).
  for (const [name, url, label] of [
    ['dashboard skeleton', '/design-preview/dashboard?role=admin&data=loading', 'Loading your dashboard'],
    ['onboarding skeleton', '/design-preview/onboarding', 'Loading'],
  ]) {
    const page = await browser.newPage({ viewport: { width: 360, height: 780 } })
    const started = Date.now()
    await page.goto(base + url, { waitUntil: 'commit' })
    await page.getByRole('status', { name: label }).waitFor({ state: 'attached' })
    const paint = await page.evaluate(() => performance.getEntriesByType('paint').find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? null)
    console.log(`INFO ${name}: visible ${Date.now() - started} ms after navigation (wall clock, includes server time), first contentful paint ${paint === null ? 'n/a' : `${Math.round(paint)} ms`}`)
    await page.close()
  }

  // SH-11: Kavi's typing never blocks input. Press Let's go while the greeting
  // is still typing, then pick an answer while the question is still typing.
  {
    const page = await browser.newPage({ viewport: { width: 360, height: 780 } })
    await page.goto(base + '/design-preview/onboarding', { waitUntil: 'domcontentloaded' })
    const go = page.getByRole('button', { name: "Let's go" })
    await go.waitFor()
    const typingAtStart = await page.getByTestId('kavi-typing').count()
    const t0 = Date.now()
    await go.click({ timeout: 2000 })
    await page.getByRole('list', { name: 'Answers' }).waitFor({ timeout: 2000 })
    check("Let's go during greeting typing", true, `greeting typing indicator shown: ${typingAtStart > 0}, next question in ${Date.now() - t0} ms`)

    const chip = page.getByRole('button', { name: 'With a team', exact: true })
    const typingBefore = await page.getByTestId('kavi-typing').count()
    const t1 = Date.now()
    await chip.click({ timeout: 1000 })
    await page.getByText('Children and teens').first().waitFor({ timeout: 1000 })
    check('answer chip during question typing', Date.now() - t1 < 1000, `question still typing: ${typingBefore > 0}, answer acted in ${Date.now() - t1} ms`)

    // Any key shows the rest of the line (ONB-01).
    await page.keyboard.press('Shift')
    const typingAfterKey = await page.getByTestId('kavi-typing').count()
    check('any key finishes typing', typingAfterKey === 0, `typing indicators after a key: ${typingAfterKey}`)
    await page.close()
  }

  // SH-11: dashboard controls respond during first render. Click Next week
  // and a day straight after load.
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto(base + '/design-preview/dashboard?role=admin&data=populated', { waitUntil: 'domcontentloaded' })
    const mine = page.getByRole('button', { name: 'Mine only' })
    await mine.waitFor()
    const t0 = Date.now()
    await mine.click({ timeout: 1000 })
    const pressed = await mine.getAttribute('aria-pressed')
    check('Mine only straight after load', pressed === 'true', `aria-pressed=${pressed} after ${Date.now() - t0} ms`)
    const day = page.getByRole('group', { name: 'Days of the week' }).getByRole('button').nth(4)
    await day.click({ timeout: 1000 })
    check('day filter straight after load', (await day.getAttribute('aria-pressed')) === 'true', 'day button pressed')
    await page.close()
  }

  // Setup: Skip this step responds at once and the progress bar fill does not hold it up.
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto(base + '/design-preview/setup?role=admin&state=some', { waitUntil: 'domcontentloaded' })
    const skip = page.getByRole('button', { name: /Skip this step/ })
    await skip.waitFor()
    const t0 = Date.now()
    await skip.click({ timeout: 1000 })
    const acted = await page.getByRole('button', { name: 'Do this step' }).waitFor({ timeout: 1000 }).then(() => true, () => false)
    check('Skip this step straight after load', acted, `row skipped ${Date.now() - t0} ms after the click`)
    await page.close()
  }
} finally {
  await browser.close()
}
process.exit(results.every((result) => result.pass) ? 0 : 1)
