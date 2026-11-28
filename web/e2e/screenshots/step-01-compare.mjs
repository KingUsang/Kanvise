// Side-by-side images for the build step 1 PR: a Bobbin screenshot on the
// left and the matching Kanvise screenshot on the right.
//
// The Bobbin screenshots are the owner's research and are not in this branch.
// Point the script at them, from web/:
//   BOBBIN_ATLAS=<path to bobbin-appatlas> BOBBIN_CAPTURE=<path to step01-bobbin-capture> \
//   node e2e/screenshots/step-01-compare.mjs
// Run step-01-shell.mjs first. Output: docs/design/screenshots/01-app-shell/compare/
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const shots = path.resolve(here, '../../../docs/design/screenshots/01-app-shell')
const out = path.join(shots, 'compare')
const atlas = process.env.BOBBIN_ATLAS
const capture = process.env.BOBBIN_CAPTURE
if (!atlas || !capture) throw new Error('Set BOBBIN_ATLAS and BOBBIN_CAPTURE')

// Boxes (native Bobbin pixels) that hide email addresses visible in the
// atlas screenshots, so no real address lands in the repo.
const masks = {
  'dashboard-account-menu.png': [[18, 806, 200, 24]],
  'tutor-account-menu.png': [[18, 570, 225, 30]],
  'tutor-global-search--results.png': [[512, 213, 250, 25]],
}

/** [output name, title, Bobbin file, Kanvise file] */
const pairs = [
  ['admin-sidebar', 'Admin sidebar, desktop', `${atlas}/00-recon/screenshots/post-login.png`, 'admin-1280-default.png'],
  ['tutor-sidebar', 'Tutor sidebar, desktop', `${atlas}/15-tutor-role/screenshots/tutor-dashboard--default.png`, 'tutor-1280-default.png'],
  ['loading', 'Page loading', `${atlas}/01-dashboard/screenshots/page--default.png`, 'admin-1280-loading.png'],
  ['admin-account-menu', 'Admin account menu', `${atlas}/01-dashboard/screenshots/dashboard-account-menu.png`, 'admin-1280-account-menu.png'],
  ['tutor-account-menu', 'Tutor account menu', `${atlas}/15-tutor-role/screenshots/tutor-account-menu.png`, 'tutor-1280-account-menu.png'],
  ['admin-help-menu', 'Admin help menu', `${atlas}/01-dashboard/screenshots/dashboard-help-updates.png`, 'admin-1280-help-menu.png'],
  ['tutor-help-menu', 'Tutor help menu', `${atlas}/15-tutor-role/screenshots/tutor-help-updates--open.png`, 'tutor-1280-help-menu.png'],
  ['whats-new', "What's new", `${atlas}/15-tutor-role/screenshots/tutor-whats-new.png`, 'tutor-1280-whats-new.png'],
  ['search-browse', 'Search, Browse by type', `${atlas}/01-dashboard/screenshots/dashboard-global-search.png`, 'admin-1280-search-browse.png'],
  ['search-results', 'Search results', `${atlas}/15-tutor-role/screenshots/tutor-global-search--results.png`, 'tutor-1280-search-results.png'],
  ['phone-bottom-bar', 'Phones: Bobbin promotes its mobile app; Kanvise has a bottom bar', `${atlas}/01-dashboard/screenshots/dashboard-mobile-app.png`, 'admin-360-default.png'],
  ['phone-more-sheet', 'Phones: Bobbin mobile app details; Kanvise More sheet', `${atlas}/15-tutor-role/screenshots/tutor-mobile-app-learn-more.png`, 'admin-360-more-sheet.png'],
  ['email-settings', 'Email switches (Bobbin settings) and the unsubscribe page (Kanvise)', `${atlas}/14-settings/screenshots/settings-emails.png`, 'student-1280-unsubscribe-confirm.png'],
  ['toast', 'Toast', `${atlas}/14-settings/screenshots/settings-lessons-reset-confirmation.png`, 'admin-1280-undo-toast.png'],
  ['desktop-rail', 'Collapsed sidebar rail', `${capture}/sidebar/collapsed-rail-1440.png`, 'admin-1280-rail.png'],
  ['tablet-768', 'Tablet, 768px', `${capture}/responsive/dashboard-768.png`, 'admin-768-default.png'],
  ['tablet-expanded', 'Tablet navigation open', `${capture}/responsive/drawer-open-820.png`, 'admin-768-rail-expanded.png'],
  ['phone-navigation', 'Phone navigation open', `${capture}/responsive/drawer-open-390.png`, 'admin-360-more-sheet.png'],
  ['share-feedback', 'Share feedback', `${capture}/help/share-feedback-empty.png`, 'admin-1280-feedback-empty.png'],
  ['search-no-results', 'Search, no results', `${capture}/search/no-results.png`, 'admin-1280-search-no-results.png'],
  ['phone-search', 'Search on a phone', `${capture}/search/results-390.png`, 'admin-360-search-results.png'],
]

const pngSize = (buffer) => [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]
const dataUrl = async (file) => `data:image/png;base64,${(await readFile(file)).toString('base64')}`
const escape = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1480, height: 600 }, deviceScaleFactor: 1 })
for (const [name, title, bobbin, kanvise] of pairs) {
  const kanviseFile = path.join(shots, kanvise)
  if (!existsSync(bobbin) || !existsSync(kanviseFile)) {
    console.log(name, 'MISSING', existsSync(bobbin) ? kanvise : bobbin)
    continue
  }
  const [bobbinWidth, bobbinHeight] = pngSize(await readFile(bobbin))
  const boxes = (masks[path.basename(bobbin)] ?? []).map(([x, y, w, h]) =>
    `<div class="mask" style="left:${(x / bobbinWidth) * 100}%;top:${(y / bobbinHeight) * 100}%;width:${(w / bobbinWidth) * 100}%;height:${(h / bobbinHeight) * 100}%">email hidden</div>`).join('')
  const column = (label, src, overlay = '') => `<figure><figcaption>${label}</figcaption><div class="frame"><img src="${src}">${overlay}</div></figure>`
  await page.setContent(`<!doctype html><html><head><style>
    body { margin: 0; padding: 20px; font: 16px/1.4 system-ui, sans-serif; background: #e7e5e4; color: #1b1c1c; }
    h1 { font-size: 18px; margin: 0 0 12px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
    figure { margin: 0; }
    figcaption { font-weight: 600; margin-bottom: 8px; }
    .frame { position: relative; width: fit-content; max-width: 100%; }
    .mask { position: absolute; background: #57534e; color: white; font-size: 9px; display: flex; align-items: center; justify-content: center; }
    img { display: block; max-width: 100%; height: auto; border: 1px solid #a8a29e; background: white; }
  </style></head><body><h1>${escape(title)}</h1><div class="row">
    ${column('Bobbin', await dataUrl(bobbin), boxes)}
    ${column('Kanvise', await dataUrl(kanviseFile))}
  </div></body></html>`)
  await page.waitForLoadState('load')
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true })
  console.log(name, 'ok')
}
await browser.close()
