// Side-by-side images for the build step 2 PR: a Bobbin screenshot on the
// left and the matching Kanvise screenshot on the right.
//
// The Bobbin screenshots are the owner's research and are not in this branch.
// Point the script at the atlas, from web/:
//   BOBBIN_ATLAS=<path to bobbin-appatlas> node e2e/screenshots/step-02-compare.mjs
// Run step-02-dashboard-setup.mjs first.
// Output: docs/design/screenshots/02-dashboard-setup/compare/
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const shots = path.resolve(here, '../../../docs/design/screenshots/02-dashboard-setup')
const out = path.join(shots, 'compare')
const atlas = process.env.BOBBIN_ATLAS
if (!atlas) throw new Error('Set BOBBIN_ATLAS')

// Boxes (native Bobbin pixels) that hide email addresses visible in the
// atlas screenshots, so no real address lands in the repo.
const masks = {
  'dashboard-account-menu.png': [[18, 806, 200, 24]],
}

/** [output name, title, Bobbin file, Kanvise file] (names from 03 and 02 "Checked against Bobbin") */
const pairs = [
  ['tutor-dashboard', 'Tutor dashboard (03 DB-01, DB-03, DB-04)', `${atlas}/15-tutor-role/screenshots/tutor-dashboard--default.png`, 'dashboard-tutor-populated-1280.png'],
  ['admin-dashboard', 'Admin dashboard, populated (new reference, replaces page--default)', `${atlas}/00-recon/screenshots/setup--post-test-data.png`, 'dashboard-admin-populated-1280.png'],
  ['admin-dashboard-full-width', 'Admin dashboard, full width', `${atlas}/01-dashboard/screenshots/dashboard-help-updates.png`, 'dashboard-admin-populated-1280.png'],
  ['dashboard-right-column', 'Right column cards (Bobbin) and the Kanvise single column', `${atlas}/01-dashboard/screenshots/dashboard-account-menu.png`, 'dashboard-independent-populated-1280.png'],
  ['dashboard-loading', 'Dashboard loading', `${atlas}/01-dashboard/screenshots/page--default.png`, 'dashboard-admin-loading-1280.png'],
  ['dashboard-empty', 'Empty dashboard (Bobbin has no capture; nearest is the tutor dashboard)', `${atlas}/15-tutor-role/screenshots/tutor-dashboard--default.png`, 'dashboard-tutor-empty-1280.png'],
  ['live-view', 'Live view (Bobbin) and Today (Kanvise; Live now is hidden until step 5)', `${atlas}/15-tutor-role/screenshots/tutor-live-view.png`, 'dashboard-admin-populated-1280.png'],
  ['setup-checklist', 'Setup checklist (02 SET-01)', `${atlas}/00-recon/screenshots/post-login.png`, 'setup-admin-fresh-1280.png'],
  ['setup-some-done', 'Setup checklist with steps done', `${atlas}/00-recon/screenshots/post-login.png`, 'setup-admin-some-done-1280.png'],
  ['after-setup', 'After setup: Setup item gone', `${atlas}/00-recon/screenshots/setup--post-test-data.png`, 'setup-admin-all-set-1280.png'],
  ['invited-tutor', 'Invited tutor: no Setup item, lands on the dashboard', `${atlas}/15-tutor-role/screenshots/tutor-dashboard--default.png`, 'dashboard-tutor-populated-1280.png'],
  ['sample-course', 'Sample course (Bobbin) and the onboarding chat (Kanvise; sample course hidden until step 4)', `${atlas}/04-courses/screenshots/sample-course--outline.png`, 'onboarding-hello-1280.png'],
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
