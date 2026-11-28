// Build step 1 responsive checks (16-responsive R-09) and an axe scan.
//
// Not a Playwright test (no .spec/.test suffix). Run against a build made with
// NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1, from web/:
//   BASE_URL=http://localhost:3125 node e2e/screenshots/step-01-checks.mjs
//
// axe-core is already in node_modules (through eslint-plugin-jsx-a11y), so the
// scan injects it directly instead of adding @axe-core/playwright.
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const axePath = require.resolve('axe-core/axe.min.js')
const base = process.env.BASE_URL || 'http://localhost:3125'

const pages = [
  ['admin shell', '/design-preview/shell?role=admin'],
  ['tutor shell', '/design-preview/shell?role=tutor'],
  ['independent shell', '/design-preview/shell?role=independent'],
  ['admin long names', '/design-preview/shell?role=admin&long=1'],
  ['admin More sheet', '/design-preview/shell?role=admin&open=more'],
  ['admin search results', '/design-preview/shell?role=admin&search=results'],
  ['admin offline', '/design-preview/shell?role=admin&connection=offline'],
  ['tutor admins only', '/design-preview/shell?role=tutor&page=admin-only'],
  ['admin undo toast', '/design-preview/shell?role=admin&toast=undo'],
  ['unsubscribe confirm', '/unsubscribe?preview=confirm&label=lesson%20reminder'],
  ['unsubscribe success', '/unsubscribe?preview=success&label=lesson%20reminder'],
  ['unsubscribe expired', '/unsubscribe?preview=expired'],
]

const browser = await chromium.launch()
const results = []

async function open(url, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' })
  await page.goto(base + url, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForTimeout(url.includes('search=') || url.includes('toast=') ? 1200 : 500)
  return page
}

// Interactive elements smaller than 44x44 px. Inline links inside a sentence
// are allowed by WCAG 2.5.8, so they are listed separately.
const smallTargets = () => {
  const selector = 'a[href], button, input:not([type=hidden]), select, textarea, [role=menuitem], [role=option], [role=tab], [tabindex="0"]'
  const out = []
  for (const element of document.querySelectorAll(selector)) {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden') continue
    if (element.closest('[inert], [aria-hidden="true"]')) continue
    if (rect.width >= 44 && rect.height >= 44) continue
    const inline = element.tagName === 'A' && style.display === 'inline'
    const name = (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || element.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
    out.push(`${inline ? 'inline link ' : ''}"${name}" ${Math.round(rect.width)}x${Math.round(rect.height)}`)
  }
  return out
}

// With a long page scrolled to the end, is the last item above the bottom bar,
// and how many fixed or sticky things sit in the bottom quarter apart from it?
const bottomChecks = () => {
  const main = document.getElementById('main-content')
  const bar = document.querySelector('nav[aria-label="Bottom bar"]')
  if (!main || !bar || bar.hidden || bar.getBoundingClientRect().height === 0) return null
  const filler = document.createElement('div')
  filler.style.height = '2400px'
  const last = document.createElement('p')
  last.textContent = 'Last item'
  main.append(filler, last)
  window.scrollTo(0, document.documentElement.scrollHeight)
  const barTop = bar.getBoundingClientRect().top
  const lastBottom = last.getBoundingClientRect().bottom
  const fixed = []
  for (const element of document.body.querySelectorAll('*')) {
    if (bar.contains(element) || element.contains(bar)) continue
    const style = getComputedStyle(element)
    if (style.position !== 'fixed' && style.position !== 'sticky') continue
    const rect = element.getBoundingClientRect()
    if (rect.height === 0 || rect.width === 0 || style.visibility === 'hidden') continue
    if (rect.top < window.innerHeight * 0.75) continue
    if (fixed.some((parent) => parent.contains(element))) continue
    fixed.push(element)
  }
  // Sonner's list is a zero-height fixed box, so count its toasts directly.
  for (const toast of document.querySelectorAll('[data-sonner-toast]')) {
    if (toast.getBoundingClientRect().height > 0) fixed.push(toast)
  }
  filler.remove()
  last.remove()
  return {
    lastItemClear: lastBottom <= barTop,
    gap: Math.round(barTop - lastBottom),
    fixedAboveBar: fixed.map((element) => element.getAttribute('aria-label') || element.className.toString().slice(0, 40)),
  }
}

for (const [label, url] of pages) {
  const row = { label }
  let page = await open(url, 320, 700)
  row.scroll320 = await page.evaluate(() => document.documentElement.scrollWidth)
  await page.close()

  page = await open(url, 360, 780)
  row.small360 = await page.evaluate(smallTargets)
  row.bottom360 = await page.evaluate(bottomChecks)
  await page.addScriptTag({ path: axePath })
  row.axe360 = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })
    return result.violations.map((violation) => `${violation.id} (${violation.impact}, ${violation.nodes.length})`)
  })
  await page.close()

  // Tablets are touch screens too: check the rail and the opened sidebar.
  page = await open(url, 768, 1024)
  row.small768 = await page.evaluate(smallTargets)
  const toggle = page.locator('[aria-controls="dashboard-sidebar"]').first()
  if (url.includes('/design-preview/') && !url.includes('search=') && !url.includes('open=') && (await toggle.isVisible())) {
    await toggle.click()
    await page.waitForTimeout(300)
    row.small768 = [...new Set([...row.small768, ...(await page.evaluate(smallTargets))])]
  }
  await page.close()

  page = await open(url, 1280, 900)
  row.small1280 = await page.evaluate(smallTargets)
  await page.addScriptTag({ path: axePath })
  row.axe1280 = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })
    return result.violations.map((violation) => `${violation.id} (${violation.impact}, ${violation.nodes.length})`)
  })
  await page.close()
  results.push(row)
}
await browser.close()

let failed = false
for (const row of results) {
  const scrollOk = row.scroll320 <= 320
  const bottomOk = !row.bottom360 || (row.bottom360.lastItemClear && row.bottom360.fixedAboveBar.length <= 1)
  if (!scrollOk || !bottomOk) failed = true
  console.log(`\n## ${row.label}`)
  console.log(`320px scroll width: ${row.scroll320} ${scrollOk ? 'ok' : 'HORIZONTAL SCROLL'}`)
  console.log(`bottom bar (360): ${row.bottom360 ? JSON.stringify(row.bottom360) : 'no bottom bar on this page'}`)
  console.log(`under 44px (360): ${row.small360.length ? row.small360.join('; ') : 'none'}`)
  console.log(`under 44px (768): ${row.small768.length ? row.small768.join('; ') : 'none'}`)
  console.log(`under 44px (1280): ${row.small1280.length ? row.small1280.join('; ') : 'none'}`)
  console.log(`axe (360): ${row.axe360.length ? row.axe360.join('; ') : 'no violations'}`)
  console.log(`axe (1280): ${row.axe1280.length ? row.axe1280.join('; ') : 'no violations'}`)
}
if (failed) process.exitCode = 1
