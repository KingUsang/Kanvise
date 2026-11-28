const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

const baseUrl = 'https://app.withbobbin.com';
const root = __dirname;
const screenshotDir = path.join(root, 'screenshots');
const evidenceDir = path.join(root, 'evidence');
fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });

function credentialsFromStdin() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  return new Promise((resolve) => {
    const values = [];
    const ask = () => rl.question(values.length ? 'Password: ' : 'Email: ', (answer) => {
      values.push(answer);
      if (values.length === 2) { rl.close(); resolve({ email: values[0], password: values[1] }); }
      else ask();
    });
    ask();
  });
}

async function snapshot(page, stem, extra = {}) {
  await page.screenshot({ path: path.join(screenshotDir, `${stem}.png`), fullPage: true });
  const data = await page.evaluate(() => ({
    capturedAt: new Date().toISOString(),
    url: location.href,
    title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((node) => node.textContent.trim()),
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim(),
    controls: [...document.querySelectorAll('input,select,textarea,button,a')].map((node) => ({
      tag: node.tagName.toLowerCase(), type: node.getAttribute('type'), id: node.id || null,
      text: node.textContent.trim() || null, label: node.getAttribute('aria-label'),
      placeholder: node.getAttribute('placeholder'), href: node.getAttribute('href'),
      disabled: node.disabled || false,
    })),
  }));
  fs.writeFileSync(path.join(evidenceDir, `${stem}.json`), `${JSON.stringify({ ...data, ...extra }, null, 2)}\n`);
}

(async () => {
  const credentials = await credentialsFromStdin();
  const targetEmail = credentials.email;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-GB' });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  credentials.email = '';
  credentials.password = '';
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 20000 });

  await page.goto(`${baseUrl}/tutors`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.getByRole('heading', { name: 'Tutors', exact: true }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  const alreadyTutor = (await page.locator('body').innerText()).toLowerCase().includes(targetEmail.toLowerCase());
  await snapshot(page, 'admin-tutors--before-same-email-test', { targetAlreadyListedAsTutor: alreadyTutor });

  if (alreadyTutor) {
    fs.writeFileSync(path.join(root, 'result.json'), `${JSON.stringify({ outcome: 'already-listed-as-tutor' }, null, 2)}\n`);
    await browser.close();
    return;
  }

  await page.getByRole('button', { name: 'Add tutor', exact: true }).first().click();
  await page.locator('[role=dialog]').waitFor({ timeout: 8000 });
  const dialog = page.locator('[role=dialog]');
  const textInputs = dialog.locator('input');
  const count = await textInputs.count();
  for (let index = 0; index < count; index += 1) {
    const input = textInputs.nth(index);
    const type = await input.getAttribute('type');
    const id = (await input.getAttribute('id')) || '';
    const placeholder = (await input.getAttribute('placeholder')) || '';
    if (type === 'email' || /email/i.test(id + placeholder)) await input.fill(targetEmail);
    else if (/first/i.test(id + placeholder)) await input.fill('Emmanuel');
    else if (/last/i.test(id + placeholder)) await input.fill('Usang');
  }
  await snapshot(page, 'admin-tutors--same-email-form-filled');

  let apiResult = null;
  page.on('response', async (response) => {
    if (response.request().method() !== 'POST' || !/tutor|membership|invite/i.test(response.url())) return;
    let keys = [];
    try {
      const body = await response.json();
      keys = body && typeof body === 'object' ? Object.keys(body) : [];
    } catch {}
    apiResult = { urlPath: new URL(response.url()).pathname, status: response.status(), responseKeys: keys.filter((key) => !/token|password|secret/i.test(key)) };
  });

  const formValidity = await dialog.locator('form').evaluate((form) => ({
    valid: form.checkValidity(),
    invalidControlIds: [...form.elements].filter((element) => typeof element.checkValidity === 'function' && !element.checkValidity()).map((element) => element.id || element.name || element.type),
  }));
  await dialog.locator('form').evaluate((form) => form.requestSubmit(form.querySelector('button[type=submit]')));
  await dialog.getByRole('button', { name: /as a tutor$/ }).waitFor({ timeout: 8000 });
  await snapshot(page, 'admin-tutors--same-email-confirmation', { formValidity });
  await dialog.locator('form').evaluate((form) => form.requestSubmit(form.querySelector('button[type=submit]')));
  await page.waitForTimeout(2200);
  const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  const alertText = await page.locator('[role=alert]').allTextContents().catch(() => []);
  const dialogStillOpen = await dialog.isVisible().catch(() => false);
  await snapshot(page, 'admin-tutors--same-email-submit-result', { apiResult, dialogStillOpen, alertText, formValidity });
  const nowListed = bodyText.toLowerCase().includes(targetEmail.toLowerCase());
  const result = { outcome: dialogStillOpen ? 'submission-rejected-or-needs-action' : nowListed ? 'tutor-row-created' : 'submitted-without-visible-row', apiResult, alertText };
  fs.writeFileSync(path.join(root, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ outcome: result.outcome, apiStatus: apiResult?.status || null, alertCount: alertText.length }));
  await browser.close();
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
