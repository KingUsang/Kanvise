const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = 'https://app.withbobbin.com';
const root = __dirname;
const screenshotDir = path.join(root, 'screenshots');
const evidenceDir = path.join(root, 'evidence');
const viewports = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const setupToken = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ email: 'atlas.research@example.com', new: true })}.research`;
const previewBase = {
  organization_name: 'Atlas Research Academy',
  user_type: 'tutor',
  state: 'pending',
  password_required: false,
  from_tutorcruncher: false,
};

const states = [
  { id: 'login--two-factor-code', route: '/login', kind: 'two-factor' },
  { id: 'login--two-factor-recovery-code', route: '/login', kind: 'two-factor-recovery' },
  { id: 'login--two-factor-invalid-code', route: '/login', kind: 'two-factor-invalid' },
  { id: 'set-password--form', route: `/auth/set-password?token=${encodeURIComponent(setupToken)}` },
  { id: 'set-password--mismatch-validation', route: `/auth/set-password?token=${encodeURIComponent(setupToken)}`, kind: 'password-mismatch' },
  { id: 'confirm-signup--form', route: `/auth/confirm-signup?token=${encodeURIComponent(setupToken)}` },
  { id: 'confirm-signup--password-validation', route: `/auth/confirm-signup?token=${encodeURIComponent(setupToken)}`, kind: 'signup-password-validation' },
  { id: 'accept-invite--existing-account', route: '/auth/accept-invite?token=research-invite', kind: 'invite', preview: previewBase },
  { id: 'accept-invite--password-required', route: '/auth/accept-invite?token=research-invite', kind: 'invite', preview: { ...previewBase, user_type: 'student', password_required: true } },
  { id: 'accept-invite--already-accepted', route: '/auth/accept-invite?token=research-invite', kind: 'invite', preview: { ...previewBase, user_type: 'administrator', state: 'accepted' } },
  { id: 'accept-invite--declined', route: '/auth/accept-invite?token=research-invite', kind: 'invite', preview: { ...previewBase, state: 'declined' } },
  { id: 'accept-invite--withdrawn', route: '/auth/accept-invite?token=research-invite', kind: 'invite', preview: { ...previewBase, state: 'canceled' } },
  { id: 'accept-invite--expired', route: '/auth/accept-invite?token=research-invite', kind: 'invite', preview: { ...previewBase, state: 'expired' } },
  { id: 'two-factor-reset--confirmation', route: '/auth/two-factor-reset?token=research-reset' },
  { id: 'two-factor-reset--success', route: '/auth/two-factor-reset?token=research-reset', kind: 'two-factor-reset-success' },
  { id: 'recording-consent--request', route: '/recording-consent#token=research-consent', kind: 'consent', preview: { student_name: 'Atlas Student', organization_name: 'Atlas Research Academy', recording_consent_given: false } },
  { id: 'recording-consent--already-given', route: '/recording-consent#token=research-consent', kind: 'consent', preview: { student_name: 'Atlas Student', organization_name: 'Atlas Research Academy', recording_consent_given: true } },
  { id: 'recording-consent--success', route: '/recording-consent#token=research-consent', kind: 'consent-success', preview: { student_name: 'Atlas Student', organization_name: 'Atlas Research Academy', recording_consent_given: false } },
];

async function captureEvidence(page, state, viewportName) {
  return page.evaluate(({ id, route, viewportName }) => ({
    capturedAt: new Date().toISOString(),
    state: id,
    requestedRoute: route,
    viewport: viewportName,
    url: location.href,
    title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((node) => node.textContent.trim()),
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim(),
    controls: [...document.querySelectorAll('input,select,textarea,button,a')].map((node) => ({
      tag: node.tagName.toLowerCase(), type: node.getAttribute('type'), id: node.id || null,
      text: node.textContent.trim() || null, label: node.getAttribute('aria-label'),
      placeholder: node.getAttribute('placeholder'), href: node.getAttribute('href'),
      required: node.required || false, disabled: node.disabled || false,
    })),
  }), { id: state.id, route: state.route, viewportName });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const manifest = [];
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    for (const state of states) {
      const stem = `${viewportName}--${state.id}`;
      const screenshot = path.join(screenshotDir, `${stem}.png`);
      const evidencePath = path.join(evidenceDir, `${stem}.json`);
      if (fs.existsSync(screenshot) && fs.existsSync(evidencePath)) {
        const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
        manifest.push({ viewport: viewportName, ...state, simulatedNetworkOutcome: true, screenshot: `screenshots/${stem}.png`, evidence: `evidence/${stem}.json`, finalUrl: evidence.url, title: evidence.title, headings: evidence.headings, summary: evidence.bodyText.slice(0, 260) });
        console.log(`${stem}: existing`);
        continue;
      }
      const context = await browser.newContext({ viewport, locale: 'en-GB' });
      const page = await context.newPage();

      if (state.kind?.startsWith('two-factor') && !state.kind.includes('reset')) {
        await page.route('https://api.withbobbin.com/auth/login', (route) => route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ two_factor_required: true, two_factor_token: 'research-two-factor-token' }),
        }));
        await page.route('https://api.withbobbin.com/auth/two-factor/verify', (route) => route.fulfill({
          status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'Invalid code.' }),
        }));
      }
      if (state.kind === 'invite') {
        await page.route('https://api.withbobbin.com/membership-invites/preview', (route) => route.fulfill({
          status: 200, contentType: 'application/json', body: JSON.stringify(state.preview),
        }));
      }
      if (state.kind?.startsWith('consent')) {
        await page.route('**/recording-consent-links/preview', (route) => route.fulfill({
          status: 200, contentType: 'application/json', body: JSON.stringify(state.preview),
        }));
        await page.route('**/recording-consent-links/grant', (route) => route.fulfill({
          status: 200, contentType: 'application/json', body: JSON.stringify({ ...state.preview, recording_consent_given: true }),
        }));
      }
      if (state.kind === 'two-factor-reset-success') {
        await page.route('https://api.withbobbin.com/auth/two-factor/reset/confirm', (route) => route.fulfill({ status: 204, body: '' }));
      }

      await page.goto(`${baseUrl}${state.route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1600);

      if (state.kind?.startsWith('two-factor') && !state.kind.includes('reset')) {
        await page.locator('#email').fill('atlas.research@example.com');
        await page.locator('#password').fill('Example password');
        await page.getByRole('button', { name: 'Log in', exact: true }).click();
        await page.getByText('Enter your code').waitFor({ timeout: 8000 });
        if (state.kind === 'two-factor-recovery') await page.getByRole('button', { name: 'Use a recovery code' }).click();
        if (state.kind === 'two-factor-invalid') {
          const codeInputs = page.locator('input');
          const count = await codeInputs.count();
          for (let index = Math.max(0, count - 6); index < count; index += 1) await codeInputs.nth(index).fill('1');
          await page.waitForTimeout(700);
        }
      }
      if (state.kind === 'password-mismatch' || state.kind === 'signup-password-validation') {
        const passwordInputs = page.locator('input[type=password]');
        await passwordInputs.nth(0).fill('Example password 123!');
        await passwordInputs.nth(1).fill('Different password 456!');
        await page.getByRole('button', { name: /Set password/ }).click();
        await page.waitForTimeout(300);
      }
      if (state.kind === 'two-factor-reset-success') {
        await page.getByRole('button', { name: /Turn off two-factor/ }).click();
        await page.getByText('Two-factor authentication is off').waitFor({ timeout: 5000 });
      }
      if (state.kind === 'consent-success') {
        await page.getByRole('button', { name: /Give consent/ }).click();
        await page.getByText('Consent given').waitFor({ timeout: 5000 });
      }

      await page.screenshot({ path: screenshot, fullPage: true });
      const evidence = await captureEvidence(page, state, viewportName);
      evidence.simulatedNetworkOutcome = true;
      fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
      manifest.push({ viewport: viewportName, ...state, simulatedNetworkOutcome: true, screenshot: `screenshots/${stem}.png`, evidence: `evidence/${stem}.json`, finalUrl: evidence.url, title: evidence.title, headings: evidence.headings, summary: evidence.bodyText.slice(0, 260) });
      console.log(`${stem}: ${evidence.headings.join(' | ')}`);
      await context.close();
    }
  }
  fs.writeFileSync(path.join(root, 'token-capture-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await browser.close();
})();
