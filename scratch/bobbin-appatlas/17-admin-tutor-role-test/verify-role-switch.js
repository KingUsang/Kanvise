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
    });
    ask();
  });
}

async function snapshot(page, stem, extra = {}) {
  await page.screenshot({ path: path.join(screenshotDir, `${stem}.png`), fullPage: true });
  const data = await page.evaluate(() => ({
    capturedAt: new Date().toISOString(), url: location.href, title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((node) => node.textContent.trim()),
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim(),
    controls: [...document.querySelectorAll('button,a')].map((node) => ({
      tag: node.tagName.toLowerCase(), text: node.textContent.trim() || null,
      label: node.getAttribute('aria-label'), href: node.getAttribute('href'),
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
  let accountState = null;
  page.on('response', async (response) => {
    if (new URL(response.url()).pathname !== '/auth/me/' || response.status() !== 200) return;
    try {
      const body = await response.json();
      accountState = {
        activeRole: body.active_role,
        activeOrganizationId: body.active_organization_id,
        memberships: (body.memberships || []).map((membership) => ({ organizationId: membership.organization_id, userType: membership.user_type })),
        linkedRoles: body.linked_roles || null,
      };
    } catch {}
  });

  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  credentials.email = '';
  credentials.password = '';
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 20000 });
  await page.waitForTimeout(1200);

  await page.goto(`${baseUrl}/tutors`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.getByRole('heading', { name: 'Tutors', exact: true }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(2500);
  const tutorListed = (await page.locator('body').innerText()).toLowerCase().includes(targetEmail.toLowerCase());
  await snapshot(page, 'admin-tutors--same-identity-linked', { accountState, tutorListed });

  const accountButton = page.getByRole('button', { name: /Emmanuel Usang/ }).first();
  await accountButton.click();
  await page.waitForTimeout(500);
  await snapshot(page, 'admin-account-menu--after-tutor-link', { accountState, tutorListed });

  const visibleText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const switchCandidates = await page.locator('button,a').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent.trim(), label: node.getAttribute('aria-label'), href: node.getAttribute('href') })).filter((item) => /tutor|switch|role/i.test(`${item.text} ${item.label} ${item.href}`)));
  const switchResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/auth/me/switch-role', { timeout: 10000 });
  await page.locator('button:visible').filter({ hasText: /^Tutor$/ }).click({ timeout: 8000 });
  const tutorSwitchStatus = (await switchResponse).status();
  await page.waitForTimeout(1800);
  await snapshot(page, 'dual-role--tutor-mode-live', { tutorSwitchStatus });
  await page.locator('button[aria-label="Emmanuel Usang"]:visible').click({ timeout: 8000 });
  await snapshot(page, 'dual-role--tutor-menu-live', { tutorSwitchStatus });
  const adminResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/auth/me/switch-role', { timeout: 10000 });
  await page.locator('button:visible').filter({ hasText: /^Admin$/ }).click({ timeout: 8000 });
  const adminSwitchStatus = (await adminResponse).status();
  await page.waitForTimeout(1800);
  await snapshot(page, 'dual-role--admin-restored-live', { tutorSwitchStatus, adminSwitchStatus });
  const result = { accountState, tutorListed, switchCandidates, menuMentionsTutor: /tutor/i.test(visibleText), tutorSwitchStatus, adminSwitchStatus };
  fs.writeFileSync(path.join(root, 'verification.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ activeRole: accountState?.activeRole || null, membershipTypes: [...new Set((accountState?.memberships || []).map((item) => item.userType))], tutorListed, switchCandidateCount: switchCandidates.length, tutorSwitchStatus, adminSwitchStatus }));
  await browser.close();
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
