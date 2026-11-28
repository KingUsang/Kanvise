// Build step 2 PR screenshots (03-dashboard, 02-onboarding-and-setup).
//
// Not a Playwright test: the file name has no .spec/.test suffix, so neither
// `npm test` (vitest excludes e2e/) nor the staging Playwright config picks it up.
//
// 1. Build and start the web app with NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1
//    (the preview pages are static, so the flag must be set at build time).
// 2. From web/: BASE_URL=http://localhost:3126 node e2e/screenshots/step-02-dashboard-setup.mjs
//    Optional: ONLY=name1,name2 to retake some shots.
//
// Output: docs/design/screenshots/02-dashboard-setup/<area>-<role>-<state>-<width>.png
//
// The previews use sample data (no network, no account). The setup preview
// raises the shipped step so every checklist row shows.
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(here, '../../../docs/design/screenshots/02-dashboard-setup')
const base = process.env.BASE_URL || 'http://localhost:3126'
const only = process.env.ONLY ? process.env.ONLY.split(',') : null

const heights = { 360: 780, 768: 1024, 1280: 900 }
const widths = [360, 768, 1280]

const dashboard = (query) => `/design-preview/dashboard?${query}`
const setup = (query) => `/design-preview/setup?${query}`

async function clickChip(page, name) {
  await page.getByRole('button', { name, exact: true }).click()
}
async function firstChip(page) {
  await page.getByRole('list', { name: 'Answers' }).getByRole('button').first().waitFor()
  await page.getByRole('list', { name: 'Answers' }).getByRole('button').first().click()
}
const chatHello = async () => undefined
const chatFirstQuestion = async (page) => {
  await clickChip(page, "Let's go")
  await page.getByRole('list', { name: 'Answers' }).waitFor()
}
const chatMiddle = async (page) => {
  await chatFirstQuestion(page)
  await clickChip(page, 'With a team')
  await firstChip(page)
  await page.getByText('Children and teens').first().waitFor()
}
const chatSubjects = async (page) => {
  await chatMiddle(page)
  await firstChip(page)
  await page.getByPlaceholder('Type a subject').waitFor()
  await page.getByRole('list', { name: 'Suggested subjects' }).getByRole('button').first().click()
}
const chatSaveFailed = async (page) => {
  await chatSubjects(page)
  await clickChip(page, 'Continue')
  await firstChip(page)
  await page.getByPlaceholder('e.g. Science Students Academy').fill('Science Students Academy')
  await clickChip(page, 'Continue')
  await page.getByText("We couldn't save your answers").waitFor({ timeout: 15000 })
}
const chatForm = async (page) => {
  await page.getByRole('button', { name: 'Answer as a form instead' }).click()
}

// [file stem, url, widths, extra steps, options]
const shots = []
const add = (name, url, run, options = {}) => shots.push({ name, url, run, ...options })

for (const role of ['independent', 'tutor', 'admin']) {
  add(`dashboard-${role}-populated`, dashboard(`role=${role}&data=populated&setup=${role === 'tutor' ? 0 : 1}`))
  add(`dashboard-${role}-empty`, dashboard(`role=${role}&data=empty&setup=${role === 'tutor' ? 0 : 1}`))
  add(`dashboard-${role}-quiet-today`, dashboard(`role=${role}&data=quiet-today`))
  add(`dashboard-${role}-loading`, dashboard(`role=${role}&data=loading`))
}
// Scrolled to the end: the bottom bar never covers content (16 R-09).
for (const role of ['independent', 'tutor', 'admin']) add(`dashboard-${role}-populated-end`, dashboard(`role=${role}&data=populated`), undefined, { scrollToEnd: true })
add('setup-admin-fresh-end', setup('role=admin&state=fresh'), undefined, { scrollToEnd: true })
add('dashboard-admin-mine-only', dashboard('role=admin&data=populated&mine=1'))

add('setup-independent-fresh', setup('role=independent&state=fresh'))
add('setup-admin-fresh', setup('role=admin&state=fresh'))
add('setup-admin-some-done', setup('role=admin&state=some'))
add('setup-independent-plan-skipped', setup('role=independent&state=skipped'))
add('setup-admin-all-set', setup('role=admin&state=done'))
add('setup-admin-defaults-banner', setup('role=admin&state=fresh&banner=1'))
add('setup-admin-loading', setup('role=admin&loading=1'))

add('onboarding-hello', '/design-preview/onboarding', chatHello)
add('onboarding-first-question', '/design-preview/onboarding', chatFirstQuestion)
add('onboarding-conversation', '/design-preview/onboarding', chatMiddle)
add('onboarding-subjects', '/design-preview/onboarding', chatSubjects)
add('onboarding-save-failed', '/design-preview/onboarding', chatSaveFailed)
add('onboarding-form', '/design-preview/onboarding', chatForm)

await mkdir(out, { recursive: true })
const browser = await chromium.launch()
try {
  for (const shot of shots) {
    if (only && !only.includes(shot.name)) continue
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: heights[width] }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
      page.on('pageerror', (error) => console.error(`${shot.name}-${width}: page error: ${error.message}`))
      await page.goto(base + shot.url, { waitUntil: 'networkidle' })
      if (shot.run) await shot.run(page)
      // Let animations settle; reduced motion already removes most.
      await page.waitForTimeout(shot.name.endsWith('loading') ? 100 : 500)
      const file = path.join(out, `${shot.name}-${width}.png`)
      if (shot.scrollToEnd) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.waitForTimeout(200)
      }
      // Viewport shots: a full-page shot draws the fixed bars in the middle of
      // the page, which looks like overlap that a person never sees.
      await page.screenshot({ path: file })
      console.log(`${shot.name}-${width}`)
      await page.close()
    }
  }
} finally {
  await browser.close()
}
