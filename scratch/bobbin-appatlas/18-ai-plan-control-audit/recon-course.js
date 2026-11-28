const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

const root = __dirname;
const evidenceDir = path.join(root, 'evidence');
const screenshotDir = path.join(root, 'screenshots');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(screenshotDir, { recursive: true });

function credentialsFromStdin() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  return new Promise((resolve) => {
    const values = [];
    const ask = () => rl.question(values.length ? 'Password: ' : 'Email: ', (value) => {
      values.push(value);
      if (values.length === 2) { rl.close(); resolve({ email: values[0], password: values[1] }); }
      else ask();
    });
    ask();
  });
}

async function capture(page, stem) {
  await page.screenshot({ path: path.join(screenshotDir, `${stem}.png`), fullPage: true });
  const evidence = await page.evaluate(() => ({
    capturedAt: new Date().toISOString(),
    url: location.href,
    title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((n) => n.textContent.trim()).filter(Boolean),
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim(),
    controls: [...document.querySelectorAll('a,button,input,select,textarea,[role="button"],[role="tab"],[role="menuitem"]')].map((n, index) => ({
      index, tag: n.tagName.toLowerCase(), text: (n.textContent || '').trim() || null,
      label: n.getAttribute('aria-label'), title: n.getAttribute('title'), href: n.getAttribute('href'),
      role: n.getAttribute('role'), type: n.getAttribute('type'), name: n.getAttribute('name'),
      placeholder: n.getAttribute('placeholder'), disabled: n.disabled || false,
      visible: !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length),
    })),
  }));
  fs.writeFileSync(path.join(evidenceDir, `${stem}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

(async () => {
  const credentials = await credentialsFromStdin();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-GB' });
  const page = await context.newPage();
  await page.goto('https://app.withbobbin.com/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  credentials.email = ''; credentials.password = '';
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 20000 });
  await page.goto(process.env.ATLAS_ROUTE || 'https://app.withbobbin.com/courses/9581', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.getByText('Atlas Research Course', { exact: true }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(2500);
  const initial = await capture(page, process.env.ATLAS_STEM || 'course-summary--control-inventory');
  console.log(JSON.stringify({ url: initial.url, headings: initial.headings, visibleControls: initial.controls.filter((c) => c.visible).length }));
  await browser.close();
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
