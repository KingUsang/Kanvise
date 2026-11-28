const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

const baseUrl = 'https://app.withbobbin.com';
const root = __dirname;
const screenshotDir = path.join(root, 'screenshots');
const evidenceDir = path.join(root, 'evidence');

function credentialsFromStdin() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  return new Promise((resolve) => {
    const values = [];
    const ask = () => rl.question(values.length ? 'Password: ' : 'Email: ', (answer) => {
      values.push(answer);
      if (values.length === 2) { rl.close(); resolve({ email: values[0], password: values[1] }); }
      else ask();
    }); ask();
  });
}

async function snapshot(page, stem, extra = {}) {
  await page.screenshot({ path: path.join(screenshotDir, `${stem}.png`), fullPage: true });
  const data = await page.evaluate(() => ({
    capturedAt: new Date().toISOString(), url: location.href, title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((node) => node.textContent.trim()),
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim(),
    navLinks: [...document.querySelectorAll('a')].map((node) => ({ text: node.textContent.trim(), href: node.getAttribute('href') })).filter((item) => item.text),
  }));
  fs.writeFileSync(path.join(evidenceDir, `${stem}.json`), `${JSON.stringify({ ...data, ...extra }, null, 2)}\n`);
}

(async () => {
  const credentials = await credentialsFromStdin();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-GB' });
  const page = await context.newPage();
  const switchResponses = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === '/auth/me/switch-role') switchResponses.push({ status: response.status(), method: response.request().method() });
  });

  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  credentials.email = ''; credentials.password = '';
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 20000 });
  await page.waitForTimeout(1200);
  await snapshot(page, 'dual-role--admin-active-before-switch');

  await page.locator('button[aria-label="Emmanuel Usang"]:visible').click();
  await page.getByText('SWITCH ROLE', { exact: true }).waitFor({ timeout: 8000 });
  await page.locator('button:visible').filter({ hasText: /^Tutor$/ }).click();
  await page.waitForTimeout(2500);
  await snapshot(page, 'dual-role--tutor-active-after-switch', { switchResponses: [...switchResponses] });

  await page.locator('button[aria-label="Emmanuel Usang"]:visible').click();
  const tutorMenuText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  await snapshot(page, 'dual-role--tutor-account-menu', { switchResponses: [...switchResponses] });
  await page.locator('button:visible').filter({ hasText: /^Admin$/ }).click();
  await page.waitForTimeout(2500);
  await snapshot(page, 'dual-role--admin-restored', { switchResponses: [...switchResponses] });

  const result = {
    switchResponses,
    tutorModeObserved: /Tutor · Science Students Academy/.test(tutorMenuText),
    restoredAdminMode: /Admin · Science Students Academy/.test((await page.locator('body').innerText()).replace(/\s+/g, ' ')),
  };
  fs.writeFileSync(path.join(root, 'switch-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
  await browser.close();
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
