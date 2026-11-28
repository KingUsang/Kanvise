// Build step 1 PR screenshots (01-app-shell, 16-responsive, 18-notifications).
//
// Not a Playwright test: the file name has no .spec/.test suffix, so neither
// `npm test` (vitest excludes e2e/) nor the staging Playwright config picks it up.
//
// 1. Build and start the web app with NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1
//    (the preview pages are static, so the flag must be set at build time).
// 2. From web/: BASE_URL=http://localhost:3125 node e2e/screenshots/step-01-shell.mjs
//    Optional: ONLY=name1,name2 to retake some shots, SKIP_EXISTING=1 to
//    take only the missing ones.
//
// Output: docs/design/screenshots/01-app-shell/<role>-<width>-<state>.png
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(here, '../../../docs/design/screenshots/01-app-shell')
const base = process.env.BASE_URL || 'http://localhost:3125'
const only = process.env.ONLY ? process.env.ONLY.split(',') : null

const heights = { 360: 780, 768: 1024, 1280: 900 }
const all = [360, 768, 1280]
const shell = (query) => `/design-preview/shell?${query}`

const typeFeedback = (text, send = false) => async (page) => {
  await page.getByLabel('Message').fill(text)
  if (send) {
    await page.getByRole('button', { name: 'Send' }).click()
    await page.getByRole('alert').waitFor()
  }
}
const expandTablet = async (page) => {
  await page.locator('[aria-controls="dashboard-sidebar"]').first().click()
}
const openPhoneSwitcher = async (page) => {
  await page.getByRole('button', { name: /switch tutoring account/i }).last().click()
}

/** [name, url, widths, action?] */
const shots = []
for (const role of ['admin', 'tutor', 'independent']) {
  const q = `role=${role}`
  shots.push(
    [`${role}-%w-default`, shell(q), all],
    [`${role}-%w-rail`, shell(`${q}&rail=1`), [1280]],
    [`${role}-%w-rail-expanded`, shell(q), [768], expandTablet],
    [`${role}-%w-more-sheet`, shell(`${q}&open=more`), [360]],
    [`${role}-%w-account-menu`, shell(`${q}&open=account-menu`), [768, 1280]],
    [`${role}-%w-account-menu`, shell(`${q}&open=phone-menu`), [360]],
    [`${role}-%w-help-menu`, shell(`${q}&open=help`), [768, 1280]],
    [`${role}-%w-whats-new`, shell(`${q}&open=whats-new`), all],
    [`${role}-%w-search-browse`, shell(`${q}&search=empty`), all],
    [`${role}-%w-search-results`, shell(`${q}&search=results`), all],
    [`${role}-%w-loading`, shell(`${q}&page=loading`), all],
    [`${role}-%w-undo-toast`, shell(`${q}&toast=undo`), all],
  )
}
async function openStackedDialog(page) {
  await page.getByRole('button', { name: 'Wizard dialog' }).click()
  await page.getByLabel('Wizard course name').fill('Year 9 Maths')
  await page.getByRole('button', { name: 'Add a student' }).click()
}
shots.push(
  ['admin-%w-switcher', shell('role=admin&open=switcher'), [768, 1280]],
  ['admin-%w-switcher', shell('role=admin&open=more'), [360], openPhoneSwitcher],
  ['admin-%w-feedback-empty', shell('role=admin&open=feedback'), all],
  ['admin-%w-feedback-typed', shell('role=admin&open=feedback'), all, typeFeedback('The calendar is easy to use. Could it show public holidays?')],
  ['admin-%w-feedback-error', shell('role=admin&open=feedback'), all, typeFeedback('This message will fail in the preview.', true)],
  ['tutor-%w-feedback-empty', shell('role=tutor&open=feedback'), [1280]],
  ['admin-%w-search-no-results', shell('role=admin&search=no-results'), all],
  ['admin-%w-search-error', shell('role=admin&search=error'), [360, 1280]],
  ['admin-%w-search-offline', shell('role=admin&search=offline'), [360, 1280]],
  ['admin-%w-not-available', shell('role=admin&page=not-available'), all],
  ['tutor-%w-admins-only', shell('role=tutor&page=admin-only'), all],
  ['admin-%w-page-error', shell('role=admin&page=error'), [360, 1280]],
  ['admin-%w-signed-out', shell('role=admin&open=signed-out'), all],
  ['tutor-%w-signed-out', shell('role=tutor&open=signed-out'), [360]],
  ['admin-%w-sign-out-confirm', shell('role=admin&open=sign-out-confirm&pending=2'), [360, 1280]],
  ['admin-%w-offline', shell('role=admin&connection=offline'), all],
  ['admin-%w-reconnecting', shell('role=admin&connection=reconnecting&pending=2'), all],
  ['tutor-%w-offline', shell('role=tutor&connection=offline'), [360]],
  ['admin-%w-saving', shell('role=admin&page=saving'), [360, 1280]],
  ['admin-%w-conflict', shell('role=admin&page=conflict'), [360, 1280]],
  ['admin-%w-long-names', shell('role=admin&long=1&read=1'), all],
  ['catalog-%w', '/design-system', [360, 1280], null, { fullPage: true }],
  ['catalog-%w-stacked-dialog', '/design-system', [360, 1280], openStackedDialog],
)
for (const state of ['loading', 'confirm', 'success', 'undone', 'expired', 'error']) {
  shots.push([`student-%w-unsubscribe-${state}`, `/unsubscribe?preview=${state}&label=lesson%20reminder`, all])
}

await mkdir(out, { recursive: true })
const browser = await chromium.launch()
let failures = 0
for (const [pattern, url, widths, action, options = {}] of shots) {
  for (const width of widths) {
    const name = pattern.replace('%w', String(width))
    if (only && !only.includes(name)) continue
    if (process.env.SKIP_EXISTING && existsSync(path.join(out, `${name}.png`))) continue
    const page = await browser.newPage({ viewport: { width, height: heights[width] }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.goto(base + url, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.waitForTimeout(url.includes('search=') ? 1200 : 500)
    if (action) {
      await action(page)
      await page.waitForTimeout(600)
    }
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: Boolean(options.fullPage) })
    if (scrollWidth > width || errors.length) failures += 1
    console.log(name, scrollWidth > width ? `HORIZONTAL SCROLL ${scrollWidth}` : 'ok', errors.slice(0, 2).join(' | '))
    await page.close()
  }
}
await browser.close()
if (failures) {
  console.error(`${failures} shot(s) had page errors or horizontal scrolling`)
  process.exitCode = 1
}
